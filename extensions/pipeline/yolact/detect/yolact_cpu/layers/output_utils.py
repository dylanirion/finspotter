# """ Contains functions used to sanitize and prepare the output of Yolact. """


import torch
import torch.nn.functional as F
from yolact_cpu.layers.box_utils import crop, sanitize_coordinates


def postprocess(
    det_output,
    w,
    h,
    batch_idx=0,
    interpolation_mode="bilinear",
    crop_masks=True,
    score_threshold=0,
):
    """
    Postprocesses the output of Yolact on testing mode into a format that makes sense,
    accounting for all the possible configuration settings.

    Args:
        - det_output: The lost of dicts that Detect outputs.
        - w: The real with of the image.
        - h: The real height of the image.
        - batch_idx: If you have multiple images for this batch,
                     the image's index in the batch.
        - interpolation_mode:
            Can be 'nearest' | 'area' | 'bilinear' (see torch.nn.functional.interpolate)

    Returns 4 torch Tensors (in the following order):
        - classes [num_det]: The class idx for each detection.
        - scores  [num_det]: The confidence score for each detection.
        - boxes   [num_det, 4]: The bounding box for each detection
                                in absolute point form.
        - masks   [num_det, h, w]: Full image masks for each detection.
    """

    dets = det_output[batch_idx]

    if dets is None:
        return [torch.Tensor()] * 4  # Warning, this is 4 copies of the same thing

    if score_threshold > 0:
        keep = dets["score"] > score_threshold

        for k in dets:
            if k != "proto":
                dets[k] = dets[k][keep]

        if dets["score"].size(0) == 0:
            return [torch.Tensor()] * 4

    # im_w and im_h when it concerns bboxes.
    # This is a workaround hack for preserve_aspect_ratio
    b_w, b_h = (w, h)

    # Actually extract everything from dets now
    classes = dets["class"]
    boxes = dets["box"]
    scores = dets["score"]
    masks = dets["mask"]

    # At this points masks is only the coefficients
    proto_data = dets["proto"]

    masks = torch.matmul(proto_data, masks.t())
    masks = torch.sigmoid(masks)

    # Crop masks before upsampling because you know why
    if crop_masks:
        masks = crop(masks, boxes)

    # Permute into the correct output shape [num_dets, proto_h, proto_w]
    masks = masks.permute(2, 0, 1).contiguous()
    masks = F.interpolate(
        masks.unsqueeze(0), (h, w), mode=interpolation_mode, align_corners=False
    ).squeeze(0)

    # Binarize the masks
    masks.gt_(0.5)

    boxes[:, 0], boxes[:, 2] = sanitize_coordinates(
        boxes[:, 0], boxes[:, 2], b_w, cast=False
    )
    boxes[:, 1], boxes[:, 3] = sanitize_coordinates(
        boxes[:, 1], boxes[:, 3], b_h, cast=False
    )
    boxes = boxes.long()

    return classes, scores, boxes, masks
