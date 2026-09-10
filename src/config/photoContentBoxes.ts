/**
 * Opaque-content bounding boxes for the photo assets, measured from the PNG
 * alpha channel at asset-import time (scripts/measure-content-boxes.mjs) and
 * committed as data. Used to (a) tighten the character window around the
 * visible figure and (b) clip each <img>'s hit area to the visible figure
 * via clip-path. Originals are never modified.
 *
 * Coordinates are fractions of the canvas. Missing ids fall back to the full
 * canvas (x:0 y:0 w:1 h:1).
 */
export interface ContentBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PhotoGeometry {
  width: number;
  height: number;
  contentBox: ContentBox;
}

export const FULL_CONTENT: ContentBox = { x: 0, y: 0, w: 1, h: 1 };

export const PHOTO_GEOMETRY: Record<string, PhotoGeometry> = {
  "b1_transparent": {
    "width": 920,
    "height": 2048,
    "contentBox": {
      "x": 0.1217,
      "y": 0.0762,
      "w": 0.7587,
      "h": 0.9087
    }
  },
  "b2_transparent": {
    "width": 920,
    "height": 2048,
    "contentBox": {
      "x": 0.1717,
      "y": 0.1431,
      "w": 0.6152,
      "h": 0.8569
    }
  },
  "b3_transparent": {
    "width": 945,
    "height": 2048,
    "contentBox": {
      "x": 0,
      "y": 0.1128,
      "w": 0.7979,
      "h": 0.8872
    }
  },
  "b4_transparent": {
    "width": 771,
    "height": 1633,
    "contentBox": {
      "x": 0.1595,
      "y": 0.1102,
      "w": 0.6265,
      "h": 0.8898
    }
  },
  "b5_transparent": {
    "width": 1340,
    "height": 2048,
    "contentBox": {
      "x": 0.2306,
      "y": 0.0601,
      "w": 0.6231,
      "h": 0.9399
    }
  },
  "b6_transparent": {
    "width": 1366,
    "height": 2048,
    "contentBox": {
      "x": 0.1808,
      "y": 0.2363,
      "w": 0.7408,
      "h": 0.7061
    }
  },
  "b7_transparent": {
    "width": 1350,
    "height": 2048,
    "contentBox": {
      "x": 0.0719,
      "y": 0.0767,
      "w": 0.8156,
      "h": 0.8901
    }
  },
  "b8_transparent": {
    "width": 1320,
    "height": 2048,
    "contentBox": {
      "x": 0.0144,
      "y": 0.0405,
      "w": 0.9152,
      "h": 0.9058
    }
  },
  "b9_transparent": {
    "width": 1080,
    "height": 1648,
    "contentBox": {
      "x": 0.3287,
      "y": 0.1135,
      "w": 0.3935,
      "h": 0.8592
    }
  },
  "c11_transparent": {
    "width": 1152,
    "height": 1615,
    "contentBox": {
      "x": 0,
      "y": 0.1684,
      "w": 1,
      "h": 0.8316
    }
  },
  "c1_transparent": {
    "width": 887,
    "height": 1210,
    "contentBox": {
      "x": 0.0789,
      "y": 0.081,
      "w": 0.8692,
      "h": 0.8537
    }
  },
  "c2_transparent": {
    "width": 1093,
    "height": 1509,
    "contentBox": {
      "x": 0.0522,
      "y": 0.0702,
      "w": 0.6853,
      "h": 0.8767
    }
  },
  "c3_transparent": {
    "width": 802,
    "height": 1114,
    "contentBox": {
      "x": 0.2406,
      "y": 0.1239,
      "w": 0.5,
      "h": 0.7756
    }
  },
  "c4_transparent": {
    "width": 1152,
    "height": 2048,
    "contentBox": {
      "x": 0,
      "y": 0,
      "w": 1,
      "h": 1
    }
  },
  "c6_transparent": {
    "width": 1152,
    "height": 2048,
    "contentBox": {
      "x": 0.0677,
      "y": 0.231,
      "w": 0.9323,
      "h": 0.769
    }
  },
  "c8_transparent": {
    "width": 1152,
    "height": 2048,
    "contentBox": {
      "x": 0,
      "y": 0.2266,
      "w": 1,
      "h": 0.7734
    }
  },
  "character-placeholder": {
    "width": 1280,
    "height": 1919,
    "contentBox": {
      "x": 0,
      "y": 0.049,
      "w": 0.6008,
      "h": 0.9171
    }
  },
  "f10_transparent": {
    "width": 1024,
    "height": 1820,
    "contentBox": {
      "x": 0,
      "y": 0,
      "w": 1,
      "h": 1
    }
  },
  "f14_transparent": {
    "width": 713,
    "height": 947,
    "contentBox": {
      "x": 0,
      "y": 0.0834,
      "w": 1,
      "h": 0.9166
    }
  },
  "f15_transparent": {
    "width": 987,
    "height": 1205,
    "contentBox": {
      "x": 0,
      "y": 0.1452,
      "w": 1,
      "h": 0.8548
    }
  },
  "f1_transparent": {
    "width": 1207,
    "height": 886,
    "contentBox": {
      "x": 0.0124,
      "y": 0.0214,
      "w": 0.9337,
      "h": 0.9786
    }
  },
  "f22_transparent": {
    "width": 1024,
    "height": 1820,
    "contentBox": {
      "x": 0,
      "y": 0.1379,
      "w": 1,
      "h": 0.8621
    }
  },
  "f24_transparent": {
    "width": 1280,
    "height": 1920,
    "contentBox": {
      "x": 0.0984,
      "y": 0.1875,
      "w": 0.718,
      "h": 0.8125
    }
  },
  "f25_transparent": {
    "width": 1280,
    "height": 1920,
    "contentBox": {
      "x": 0.0086,
      "y": 0.1812,
      "w": 0.8672,
      "h": 0.8187
    }
  },
  "f26_transparent": {
    "width": 1280,
    "height": 1920,
    "contentBox": {
      "x": 0,
      "y": 0,
      "w": 1,
      "h": 1
    }
  },
  "f27_transparent": {
    "width": 1280,
    "height": 1920,
    "contentBox": {
      "x": 0.1625,
      "y": 0,
      "w": 0.8375,
      "h": 1
    }
  },
  "fa18_transparent": {
    "width": 1366,
    "height": 2048,
    "contentBox": {
      "x": 0.1069,
      "y": 0.0859,
      "w": 0.6127,
      "h": 0.9141
    }
  },
  "fa21_transparent": {
    "width": 1317,
    "height": 2048,
    "contentBox": {
      "x": 0.2992,
      "y": 0.106,
      "w": 0.4237,
      "h": 0.894
    }
  },
  "fa22_transparent": {
    "width": 1366,
    "height": 1825,
    "contentBox": {
      "x": 0.0176,
      "y": 0.0471,
      "w": 0.9224,
      "h": 0.9529
    }
  },
  "fa23_transparent": {
    "width": 1365,
    "height": 2048,
    "contentBox": {
      "x": 0,
      "y": 0.1919,
      "w": 0.9495,
      "h": 0.8081
    }
  },
  "fa24_transparent": {
    "width": 939,
    "height": 2048,
    "contentBox": {
      "x": 0.0394,
      "y": 0.0356,
      "w": 0.9606,
      "h": 0.9644
    }
  },
  "fa25_transparent": {
    "width": 1365,
    "height": 2048,
    "contentBox": {
      "x": 0.1238,
      "y": 0.1133,
      "w": 0.7707,
      "h": 0.8867
    }
  },
  "focus1_transparent": {
    "width": 1152,
    "height": 2048,
    "contentBox": {
      "x": 0,
      "y": 0.0386,
      "w": 1,
      "h": 0.9614
    }
  },
  "s10_transparent": {
    "width": 1337,
    "height": 2048,
    "contentBox": {
      "x": 0.1578,
      "y": 0.1128,
      "w": 0.7053,
      "h": 0.8516
    }
  },
  "s3_transparent": {
    "width": 1365,
    "height": 2048,
    "contentBox": {
      "x": 0.1355,
      "y": 0.0562,
      "w": 0.6967,
      "h": 0.9336
    }
  },
  "s4_transparent": {
    "width": 1365,
    "height": 2048,
    "contentBox": {
      "x": 0.0908,
      "y": 0.0928,
      "w": 0.9048,
      "h": 0.8496
    }
  },
  "s5_transparent": {
    "width": 1342,
    "height": 2048,
    "contentBox": {
      "x": 0.0969,
      "y": 0.0474,
      "w": 0.7228,
      "h": 0.9526
    }
  },
  "s6_transparent": {
    "width": 1365,
    "height": 2048,
    "contentBox": {
      "x": 0.219,
      "y": 0.0781,
      "w": 0.7619,
      "h": 0.9219
    }
  },
  "s7_transparent": {
    "width": 1347,
    "height": 2048,
    "contentBox": {
      "x": 0.1084,
      "y": 0.0571,
      "w": 0.8493,
      "h": 0.9243
    }
  },
  "s8_transparent": {
    "width": 1326,
    "height": 2048,
    "contentBox": {
      "x": 0.0641,
      "y": 0.0742,
      "w": 0.862,
      "h": 0.916
    }
  },
  "s9_transparent": {
    "width": 1344,
    "height": 2048,
    "contentBox": {
      "x": 0.1801,
      "y": 0.0884,
      "w": 0.6875,
      "h": 0.9072
    }
  },
  "st11_transparent": {
    "width": 839,
    "height": 1440,
    "contentBox": {
      "x": 0.0775,
      "y": 0.0097,
      "w": 0.9154,
      "h": 0.9903
    }
  },
  "st14_transparent": {
    "width": 960,
    "height": 1476,
    "contentBox": {
      "x": 0,
      "y": 0,
      "w": 0.65,
      "h": 1
    }
  },
  "st1_transparent": {
    "width": 1080,
    "height": 1620,
    "contentBox": {
      "x": 0.038,
      "y": 0.0512,
      "w": 0.6639,
      "h": 0.9488
    }
  },
  "st23_transparent": {
    "width": 1098,
    "height": 1680,
    "contentBox": {
      "x": 0.0774,
      "y": 0.0625,
      "w": 0.7523,
      "h": 0.9375
    }
  },
  "st3_transparent": {
    "width": 1102,
    "height": 1680,
    "contentBox": {
      "x": 0.0726,
      "y": 0.0768,
      "w": 0.6397,
      "h": 0.9232
    }
  },
  "st5_transparent": {
    "width": 1350,
    "height": 2048,
    "contentBox": {
      "x": 0.08,
      "y": 0.0732,
      "w": 0.6844,
      "h": 0.9268
    }
  },
  "st7_transparent": {
    "width": 1280,
    "height": 1950,
    "contentBox": {
      "x": 0.0141,
      "y": 0.0564,
      "w": 0.882,
      "h": 0.9282
    }
  }
};

export function photoGeometry(id: string): PhotoGeometry {
  return PHOTO_GEOMETRY[id] ?? { width: 1280, height: 1919, contentBox: FULL_CONTENT };
}
