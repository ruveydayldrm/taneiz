from __future__ import annotations

import random
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
import torch
from PIL import Image, ImageFilter
from torch.utils.data import Dataset
from torchvision import transforms as T

from common import CLASSES, IMAGENET_MEAN, IMAGENET_STD, corner_color, grain_mask, pad_to_square, random_light_background


class PadToSquare:
    def __call__(self, img: Image.Image) -> Image.Image:
        return Image.fromarray(pad_to_square(np.array(img)))


class RandomRotateFill:
    """Köşeleri siyah değil, görüntünün kendi zemin rengiyle doldurarak döndürür."""

    def __init__(self, degrees: float = 180):
        self.degrees = degrees

    def __call__(self, img: Image.Image) -> Image.Image:
        fill = corner_color(np.array(img))
        return img.rotate(random.uniform(-self.degrees, self.degrees), resample=Image.BILINEAR, fillcolor=fill)


class RandomBackgroundSwap:
    """Taneyi segmentleyip rastgele açık renkli zemine yapıştırır. Eğitim setlerinin zeminleri
    ile sahadaki (kâğıt/tepsi) zemin farklı olduğundan, modelin zemine değil taneye bakmasını sağlar."""

    def __init__(self, p: float = 0.5):
        self.p = p
        self.rng = np.random.default_rng()

    def __call__(self, img: Image.Image) -> Image.Image:
        if random.random() > self.p:
            return img
        arr = np.array(img)
        if max(arr.shape[:2]) > 320:
            s = 320 / max(arr.shape[:2])
            arr = cv2.resize(arr, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        m = grain_mask(arr)
        if m is None:
            return img
        bg = random_light_background(*arr.shape[:2], self.rng)
        alpha = cv2.GaussianBlur(m, (5, 5), 0)[..., None] / 255.0
        return Image.fromarray((arr * alpha + bg * (1 - alpha)).astype(np.uint8))


class RandomBlur:
    def __init__(self, p: float = 0.3):
        self.p = p

    def __call__(self, img: Image.Image) -> Image.Image:
        if random.random() > self.p:
            return img
        return img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 1.6)))


def build_transforms(size: int, train: bool):
    norm = [T.ToTensor(), T.Normalize(IMAGENET_MEAN, IMAGENET_STD)]
    if not train:
        return T.Compose([PadToSquare(), T.Resize((size, size), antialias=True), *norm])
    return T.Compose(
        [
            RandomBackgroundSwap(0.5),
            PadToSquare(),
            RandomRotateFill(180),
            T.RandomHorizontalFlip(),
            T.RandomVerticalFlip(),
            T.RandomResizedCrop(size, scale=(0.75, 1.0), ratio=(0.9, 1.1), antialias=True),
            T.ColorJitter(brightness=0.35, contrast=0.25, saturation=0.15, hue=0.02),
            RandomBlur(0.3),
            *norm,
        ]
    )


class GrainDataset(Dataset):
    def __init__(self, csv_path: Path, raw_dir: Path, transform, max_per_class: int | None = None, seed: int = 0):
        df = pd.read_csv(csv_path)
        if max_per_class:
            df = df.groupby("label", group_keys=False).apply(lambda g: g.sample(min(len(g), max_per_class), random_state=seed))
        self.df = df.reset_index(drop=True)
        self.raw_dir = raw_dir
        self.transform = transform
        self.targets = [CLASSES.index(l) for l in self.df["label"]]

    def __len__(self):
        return len(self.df)

    def __getitem__(self, i):
        row = self.df.iloc[i]
        img = Image.open(self.raw_dir / row["path"]).convert("RGB")
        return self.transform(img), torch.tensor(self.targets[i])
