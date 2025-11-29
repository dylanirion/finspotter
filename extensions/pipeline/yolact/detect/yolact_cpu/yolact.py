import torch
import torch.nn as nn
import torch.nn.functional as F
from itertools import product
from math import sqrt
from typing import List
from yolact_cpu.layers import Detect
from yolact_cpu.layers.interpolate import InterpolateModule
from yolact_cpu.backbone import ResNetBackbone


ScriptModuleWrapper = nn.Module
cfg = {}


def script_method_wrapper(
    fn,
    _rcn=None
):
    return fn


class Concat(nn.Module):
    def __init__(self, nets, extra_params):
        super().__init__()

        self.nets = nn.ModuleList(nets)
        self.extra_params = extra_params

    def forward(self, x):
        # Concat each along the channel dimension
        return torch.cat([net(x) for net in self.nets], dim=1, **self.extra_params)


def make_net(in_channels, conf, include_last_relu=True):
    """
    A helper function to take a config setting and turn it into a network.
    Used by protonet and extrahead. Returns (network, out_channels)
    """

    def make_layer(layer_cfg):
        nonlocal in_channels

        # Possible patterns:
        # ( 256, 3, {}) -> conv
        # ( 256,-2, {}) -> deconv
        # (None,-2, {}) -> bilinear interpolate
        # ('cat',[],{}) -> concat the subnetworks in the list
        #
        # You know it would have probably been simpler
        # just to adopt a 'c' 'd' 'u' naming scheme.
        # Whatever, it's too late now.
        if isinstance(layer_cfg[0], str):
            layer_name = layer_cfg[0]

            if layer_name == "cat":
                nets = [make_net(in_channels, x) for x in layer_cfg[1]]
                layer = Concat([net[0] for net in nets], layer_cfg[2])
                num_channels = sum([net[1] for net in nets])
        else:
            num_channels = layer_cfg[0]
            kernel_size = layer_cfg[1]

            if kernel_size > 0:
                layer = nn.Conv2d(
                    in_channels, num_channels, kernel_size, **layer_cfg[2]
                )
            else:
                if num_channels is None:
                    layer = InterpolateModule(
                        scale_factor=-kernel_size,
                        mode="bilinear",
                        align_corners=False,
                        **layer_cfg[2]
                    )
                else:
                    layer = nn.ConvTranspose2d(
                        in_channels, num_channels, -kernel_size, **layer_cfg[2]
                    )

        in_channels = num_channels if num_channels is not None else in_channels

        # Don't return a ReLU layer if we're doing an upsample.
        # This probably doesn't affect anything
        # output-wise, but there's no need to go through a ReLU here.
        # Commented out for backwards compatibility with previous models
        # if num_channels is None:
        #     return [layer]
        # else:
        return [layer, nn.ReLU(inplace=True)]

    # Use sum to concat together all the component layer lists
    net = sum([make_layer(x) for x in conf], [])
    if not include_last_relu:
        net = net[:-1]

    return nn.Sequential(*(net)), in_channels


class PredictionModule(nn.Module):
    """
    The (c) prediction module adapted from DSSD:
    https://arxiv.org/pdf/1701.06659.pdf

    Note that this is slightly different to the module in the paper
    because the Bottleneck block actually has a 3x3 convolution in
    the middle instead of a 1x1 convolution. Though, I really can't
    be arsed to implement it myself, and, who knows, this might be
    better.

    Args:
        - in_channels:   The input feature size.
        - out_channels:  The output feature size (must be a multiple of 4).
        - aspect_ratios: A list of lists of priorbox aspect ratios (one list per scale).
        - scales:        A list of priorbox scales relative to this layer's convsize.
                         For instance: If this layer has convouts of size 30x30 for
                                       an image of size 600x600, the 'default' (scale
                                       of 1) for this layer would produce bounding
                                       boxes with an area of 20x20px. If the scale is
                                       .5 on the other hand, this layer would consider
                                       bounding boxes with area 10x10px, etc.
        - parent:        If parent is a PredictionModule, this module will use
                         all the layers from parent instead of from this module.
    """

    def __init__(
        self,
        in_channels,
        out_channels=1024,
        aspect_ratios=[[1]],
        scales=[1],
        parent=None,
    ):
        super().__init__()

        self.num_classes = cfg.num_classes
        self.mask_dim = cfg.mask_dim
        self.num_priors = sum(len(x) for x in aspect_ratios)
        self.parent = [parent]  # Don't include this in the state dict

        if parent is None:
            self.upfeature, out_channels = make_net(
                in_channels, [(256, 3, {"padding": 1})]
            )

            self.bbox_layer = nn.Conv2d(
                out_channels, self.num_priors * 4, **{"kernel_size": 3, "padding": 1}
            )
            self.conf_layer = nn.Conv2d(
                out_channels,
                self.num_priors * self.num_classes,
                **{"kernel_size": 3, "padding": 1}
            )
            self.mask_layer = nn.Conv2d(
                out_channels,
                self.num_priors * self.mask_dim,
                **{"kernel_size": 3, "padding": 1}
            )

            # What is this ugly lambda doing in the middle of all this
            # clean prediction module code?
            def make_extra(num_layers):
                if num_layers == 0:
                    return lambda x: x
                else:
                    # Looks more complicated than it is. This just creates
                    # an array of num_layers alternating conv-relu
                    return nn.Sequential(
                        *sum(
                            [
                                [
                                    nn.Conv2d(
                                        out_channels,
                                        out_channels,
                                        kernel_size=3,
                                        padding=1,
                                    ),
                                    nn.ReLU(inplace=True),
                                ]
                                for _ in range(num_layers)
                            ],
                            [],
                        )
                    )

            self.bbox_extra, self.conf_extra, self.mask_extra = [
                make_extra(x) for x in (0, 0, 0)
            ]

        self.aspect_ratios = aspect_ratios
        self.scales = scales

        self.priors = None
        self.last_conv_size = None

    def forward(self, x):
        """
        Args:
            - x: The convOut from a layer in the backbone network
                 Size: [batch_size, in_channels, conv_h, conv_w])

        Returns a tuple (bbox_coords, class_confs, mask_output, prior_boxes) with sizes
            - bbox_coords: [batch_size, conv_h*conv_w*num_priors, 4]
            - class_confs: [batch_size, conv_h*conv_w*num_priors, num_classes]
            - mask_output: [batch_size, conv_h*conv_w*num_priors, mask_dim]
            - prior_boxes: [conv_h*conv_w*num_priors, 4]
        """
        # In case we want to use another module's layers
        src = self if self.parent[0] is None else self.parent[0]

        conv_h = x.size(2)
        conv_w = x.size(3)

        x = src.upfeature(x)

        bbox_x = src.bbox_extra(x)
        conf_x = src.conf_extra(x)
        mask_x = src.mask_extra(x)

        bbox = (
            src.bbox_layer(bbox_x)
            .permute(0, 2, 3, 1)
            .contiguous()
            .view(x.size(0), -1, 4)
        )
        conf = (
            src.conf_layer(conf_x)
            .permute(0, 2, 3, 1)
            .contiguous()
            .view(x.size(0), -1, self.num_classes)
        )

        mask = (
            src.mask_layer(mask_x)
            .permute(0, 2, 3, 1)
            .contiguous()
            .view(x.size(0), -1, self.mask_dim)
        )
        mask = torch.tanh(mask)

        priors = self.make_priors(conv_h, conv_w)

        preds = {"loc": bbox, "conf": conf, "mask": mask, "priors": priors}

        return preds

    def make_priors(self, conv_h, conv_w):
        """
        Note that priors are [x,y,width,height] where (x,y) is the center of the box.
        """

        if self.last_conv_size != (conv_w, conv_h):
            prior_data = []

            # Iteration order is important (it has to sync up with the convout)
            for j, i in product(range(conv_h), range(conv_w)):
                # +0.5 because priors are in center-size notation
                x = (i + 0.5) / conv_w
                y = (j + 0.5) / conv_h

                for scale, ars in zip(self.scales, self.aspect_ratios):
                    for ar in ars:
                        ar = sqrt(ar)

                        w = scale * ar / 550
                        # TODO: Fix this line.
                        h = scale * ar / 550

                        prior_data += [x, y, w, h]

            self.priors = torch.Tensor(prior_data).view(-1, 4)
            self.last_conv_size = (conv_w, conv_h)

        return self.priors


class FPN(ScriptModuleWrapper):
    """
    Implements a general version of the FPN introduced in
    https://arxiv.org/pdf/1612.03144.pdf

    Parameters (in cfg.fpn):
        - num_features (int): The number of output features in the fpn layers.
        - interpolation_mode (str): The mode to pass to F.interpolate.
        - num_downsample (int): The number of downsampled layers to add
                                onto the selected layers.
                                These extra layers are downsampled from
                                the last selected layer.

    Args:
        - in_channels (list): For each conv layer you supply in the forward pass,
                              how many features will it have?
    """

    __constants__ = [
        "interpolation_mode",
        "num_downsample",
        "use_conv_downsample",
        "lat_layers",
        "pred_layers",
        "downsample_layers",
    ]

    def __init__(self, in_channels):
        super().__init__()

        self.lat_layers = nn.ModuleList(
            [nn.Conv2d(x, 256, kernel_size=1) for x in reversed(in_channels)]
        )

        # This is here for backwards compatability
        padding = 1
        self.pred_layers = nn.ModuleList(
            [nn.Conv2d(256, 256, kernel_size=3, padding=padding) for _ in in_channels]
        )

        self.downsample_layers = nn.ModuleList(
            [nn.Conv2d(256, 256, kernel_size=3, padding=1, stride=2) for _ in range(2)]
        )

        self.interpolation_mode = "bilinear"
        self.num_downsample = 2
        self.use_conv_downsample = True

    @script_method_wrapper
    def forward(self, convouts: List[torch.Tensor]):
        """
        Args:
            - convouts (list): A list of convouts for the
                               corresponding layers in in_channels.
        Returns:
            - A list of FPN convouts in the same order as x
              with extra downsample layers if requested.
        """

        out = []
        x = torch.zeros(1, device=convouts[0].device)
        for i in range(len(convouts)):
            out.append(x)

        # For backward compatability, the conv layers are stored in
        # reverse but the input and output is
        # given in the correct order. Thus, use j=-i-1 for the input
        # and output and i for the conv layers.
        j = len(convouts)
        for lat_layer in self.lat_layers:
            j -= 1

            if j < len(convouts) - 1:
                _, _, h, w = convouts[j].size()
                x = F.interpolate(
                    x, size=(h, w), mode=self.interpolation_mode, align_corners=False
                )

            x = x + lat_layer(convouts[j])
            out[j] = x

        # This janky second loop is here because TorchScript.
        j = len(convouts)
        for pred_layer in self.pred_layers:
            j -= 1
            out[j] = F.relu(pred_layer(out[j]))

        # In the original paper, this takes care of P6
        if self.use_conv_downsample:
            for downsample_layer in self.downsample_layers:
                out.append(downsample_layer(out[-1]))
        else:
            for idx in range(self.num_downsample):
                # Note: this is an untested alternative to
                # out.append(out[-1][:, :, ::2, ::2]). Thanks TorchScript.
                out.append(nn.functional.max_pool2d(out[-1], 1, stride=2))

        return out


class Yolact(nn.Module):
    """
    Parameters:
        - selected_layers: The indices of the conv layers to use for prediction.
        - pred_scales: A list with len(selected_layers) containing
                       tuples of scales (see PredictionModule)
        - pred_aspect_ratios: A list of lists of aspect ratios
        with len(selected_layers) (see PredictionModule)
    """

    def __init__(self, config):
        global cfg
        cfg = config
        super().__init__()
        self.backbone = ResNetBackbone([3, 4, 23, 3])

        # Add downsampling layers until we reach the number we need
        while len(self.backbone.layers) < 4:
            self.backbone.add_layer()

        self.num_grids = 0
        self.proto_src = 0

        # The include_last_relu=false here is because we might want
        # to change it to another function
        self.proto_net, cfg.mask_dim = make_net(
            256,
            [(256, 3, {"padding": 1})] * 3
            + [(None, -2, {}), (256, 3, {"padding": 1})]
            + [(32, 1, {})],
            include_last_relu=False,
        )

        self.selected_layers = list(range(1, 4))
        src_channels = self.backbone.channels

        # Some hacky rewiring to accomodate the FPN
        self.fpn = FPN([src_channels[i] for i in self.selected_layers])
        self.selected_layers = list(range(len(self.selected_layers) + 2))
        src_channels = [256] * len(self.selected_layers)

        self.prediction_layers = nn.ModuleList()

        for idx, layer_idx in enumerate(self.selected_layers):
            # If we're sharing prediction module weights,
            # have every module's parent be the first one
            parent = None
            if idx > 0:
                parent = self.prediction_layers[0]

            pred = PredictionModule(
                src_channels[layer_idx],
                src_channels[layer_idx],
                aspect_ratios=([[[1, 1 / 2, 2]]] * 5)[idx],
                scales=[[24], [48], [96], [192], [384]][idx],
                parent=parent,
            )
            self.prediction_layers.append(pred)

        self.semantic_seg_conv = nn.Conv2d(
            src_channels[0], cfg.num_classes - 1, kernel_size=1
        )

        # For use in evaluation
        self.detect = Detect(
            cfg.num_classes, bkg_label=0, top_k=200, conf_thresh=0.05, nms_thresh=0.5
        )

    def load_weights(self, path):
        """Loads weights from a compressed save file."""
        state_dict = torch.load(path, map_location="cpu")

        self.load_state_dict(state_dict)

    def forward(self, x):
        """The input should be of size [batch_size, 3, img_h, img_w]"""
        outs = self.backbone(x)

        # Use backbone.selected_layers because we overwrote self.selected_layers
        outs = [outs[i] for i in list(range(1, 4))]
        outs = self.fpn(outs)

        proto_out = None
        proto_x = x if self.proto_src is None else outs[self.proto_src]

        if self.num_grids > 0:
            grids = self.grid.repeat(proto_x.size(0), 1, 1, 1)
            proto_x = torch.cat([proto_x, grids], dim=1)

        proto_out = self.proto_net(proto_x)
        proto_out = torch.nn.functional.relu(proto_out, inplace=True)

        # Move the features last so the multiplication is easy
        proto_out = proto_out.permute(0, 2, 3, 1).contiguous()

        pred_outs = {"loc": [], "conf": [], "mask": [], "priors": []}

        for idx, pred_layer in zip(self.selected_layers, self.prediction_layers):
            pred_x = outs[idx]

            # A hack for the way dataparallel works
            if pred_layer is not self.prediction_layers[0]:
                pred_layer.parent = [self.prediction_layers[0]]

            p = pred_layer(pred_x)

            for k, v in p.items():
                pred_outs[k].append(v)

        for k, v in pred_outs.items():
            pred_outs[k] = torch.cat(v, -2)

        if proto_out is not None:
            pred_outs["proto"] = proto_out

        pred_outs["conf"] = F.softmax(pred_outs["conf"], -1)

        return self.detect(pred_outs)
