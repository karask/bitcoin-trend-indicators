/** Approximate integer-only weekly fits; bounded search and fixed reference histories. */
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
      "factor": 2
    },
    "value": 4123.174088757438,
    "state": "bull",
    "previousValue": 4123.174088757438,
    "previousState": "bull",
    "lastFlip": 1786924800000,
    "through": 1788134400000,
    "candles": 400,
    "note": "Integer-only search retains 10/2. GC1! back-adjusted screenshot and Yahoo GC=F history differ."
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
    "tolerance": 0.01,
    "preset": {
      "atrLength": 45,
      "factor": 3
    },
    "previous": {
      "atrLength": 15,
      "factor": 2.4
    },
    "value": 75.7387019732357,
    "state": "bear",
    "previousValue": 75.82863651451208,
    "previousState": "bear",
    "lastFlip": 1769385600000,
    "through": 1788134400000,
    "candles": 400,
    "note": "User-requested integer-only fit: 45/3 is the closest same-regime level in ATR 1–100 / multiplier 1–10. January 26 bearish reversal matches the visible reversal month. Yahoo and back-adjusted SI1! histories differ; this is not proof of the private formula."
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
    "tolerance": 0.09,
    "preset": {
      "atrLength": 29,
      "factor": 1
    },
    "previous": {
      "atrLength": 10,
      "factor": 2.35
    },
    "value": 17.53097245241699,
    "state": "bull",
    "previousValue": 17.426372598957105,
    "previousState": "bull",
    "lastFlip": 1787529600000,
    "through": 1788134400000,
    "candles": 65,
    "note": "User-requested integer-only fit: 29/1 is the closest same-regime level in ATR 1–100 / multiplier 1–10. Calculated bullish reversal moves to August 24. Yahoo supplies only 65 completed weeks; screenshot history starts in 2018. Exact screenshot reversal date is not validated and four-year tests are unavailable."
  }
] as const;
