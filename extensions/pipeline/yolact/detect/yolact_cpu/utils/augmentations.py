import torch
from yolact_cpu.data.config import Config, MEANS, STD
import torch.nn.functional as F


class FastBaseTransform(torch.nn.Module):
    """
    Transform that does all operations on the GPU for super speed.
    This doesn't suppport a lot of config settings and should only be used for production.
    Maintain this as necessary.
    """

    def __init__(self):
        super().__init__()

        # self.mean = torch.Tensor(MEANS).float().cuda()[None, :, None, None]
        # self.std  = torch.Tensor( STD ).float().cuda()[None, :, None, None]
        self.mean = torch.Tensor(MEANS).float()[None, :, None, None]
        self.std = torch.Tensor(STD).float()[None, :, None, None]
        self.transform = Config(
            {
                "channel_order": "RGB",
                "normalize": True,
                "subtract_means": False,
                "to_float": False,
            }
        )

    def forward(self, img):
        self.mean = self.mean.to(img.device)
        self.std = self.std.to(img.device)

        img = img.permute(0, 3, 1, 2).contiguous()
        img = F.interpolate(img, (550, 550), mode="bilinear", align_corners=False)

        if self.transform.normalize:
            img = (img - self.mean) / self.std
        elif self.transform.subtract_means:
            img = img - self.mean
        elif self.transform.to_float:
            img = img / 255

        if self.transform.channel_order != "RGB":
            raise NotImplementedError

        img = img[:, (2, 1, 0), :, :].contiguous()

        # Return value is in channel order [n, c, h, w] and RGB
        return img
