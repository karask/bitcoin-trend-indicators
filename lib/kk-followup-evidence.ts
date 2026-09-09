/** Approximate feed-specific weekly reference fits; fixtures stay outside browser bundles. */
export const KK_FOLLOWUP_EVIDENCE = [
  {
    "asset": "gold",
    "market": "commodity",
    "filename": "gold.jpeg",
    "imageSha256": "8d9dba345b2a887e69d07d12b2d7e27c7017c9be300d96e4ad91bcea102e59e9",
    "reviewedAt": "2026-09-09",
    "timeframe": "1w",
    "target": 4123.7,
    "targetState": "bull",
    "tolerance": 0.6,
    "preset": {
      "atrLength": 10,
      "factor": 2
    },
    "previous": {
      "atrLength": 10,
      "factor": 3
    },
    "value": 4123.174088757438,
    "state": "bull",
    "previousValue": 4684.6259804972915,
    "previousState": "bear",
    "lastFlip": 1786924800000,
    "through": 1788134400000,
    "candles": 400,
    "note": "GC1! screenshot is back-adjusted; our GC=F contract history differs. The 10/2 baseline closely matches the latest level and August bullish reversal."
  },
  {
    "asset": "silver",
    "market": "commodity",
    "filename": "silver.jpeg",
    "imageSha256": "4e66eb6708337f0cc436cf047afb218b89b99471e7b8a1d0188033869a62a96e",
    "reviewedAt": "2026-09-09",
    "timeframe": "1w",
    "target": 75.73,
    "targetState": "bear",
    "tolerance": 0.11,
    "preset": {
      "atrLength": 15,
      "factor": 2.4
    },
    "previous": {
      "atrLength": 10,
      "factor": 3
    },
    "value": 75.82863651451208,
    "state": "bear",
    "previousValue": 78.30538272503735,
    "previousState": "bear",
    "lastFlip": 1769385600000,
    "through": 1788134400000,
    "candles": 400,
    "note": "SI1! screenshot is back-adjusted; Yahoo SI=F has different candles/rolls. Approximate feed-specific fit, not proof of the private formula. 7/3 is numerically close but flips bearish in March rather than the January reversal visible in the screenshot."
  },
  {
    "asset": "bmnr",
    "market": "equity",
    "filename": "bitmine.jpeg",
    "imageSha256": "22c04a060be2802991d92b5775e0688c38959b7cc9cae5d66a4f0ada434e3da1",
    "reviewedAt": "2026-09-09",
    "timeframe": "1w",
    "target": 17.45,
    "targetState": "bull",
    "tolerance": 0.03,
    "preset": {
      "atrLength": 10,
      "factor": 2.35
    },
    "previous": {
      "atrLength": 10,
      "factor": 3
    },
    "value": 17.426372598957105,
    "state": "bull",
    "previousValue": 15.312177870313011,
    "previousState": "bull",
    "lastFlip": 1786924800000,
    "through": 1788134400000,
    "candles": 65,
    "note": "Screenshot begins in 2018; Yahoo BMNR only supplies data from June 2025. Keep ATR 10 and adjust only the multiplier to approximate the latest level. Earlier chart history and exact flip date are not validated; four-year tests are unavailable."
  }
] as const;
