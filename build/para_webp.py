"""Converte as imagens das questões de PNG para WebP sem perdas (cerca de 55% menores)."""
import os, sys
from multiprocessing import Pool
from PIL import Image
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "img")

def conv(f):
    o = f[:-4] + ".webp"
    Image.open(os.path.join(IMG, f)).convert("RGB").save(os.path.join(IMG, o), "WEBP", lossless=True, method=4)
    return os.path.getsize(os.path.join(IMG, f)), os.path.getsize(os.path.join(IMG, o))

if __name__ == "__main__":
    fs = [f for f in os.listdir(IMG) if f.endswith(".png")]
    with Pool(8) as p:
        r = p.map(conv, fs, chunksize=10)
    print(len(fs), "imagens;", round(sum(a for a, b in r) / 1e6), "MB ->", round(sum(b for a, b in r) / 1e6), "MB")
