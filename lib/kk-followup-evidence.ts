/** Shared weekly preset family; accepted screenshot deviations on fixed reference histories. */
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
    "tolerance": 2.84,
    "preset": {
      "atrLength": 15,
      "factor": 2
    },
    "previous": {
      "atrLength": 45,
      "factor": 3
    },
    "value": 72.89678030160348,
    "state": "bear",
    "previousValue": 75.7387019732357,
    "previousState": "bear",
    "lastFlip": 1769385600000,
    "through": 1788134400000,
    "candles": 400,
    "note": "User-selected shared 15/2 preset: flip is 3.74% below the screenshot, retaining the January 26 bearish reversal. 10/3 is slightly closer in level but reverses in March. Yahoo and back-adjusted SI1! histories differ; this is not proof of the private formula."
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
    "tolerance": 0.70,
    "preset": {
      "atrLength": 15,
      "factor": 2
    },
    "previous": {
      "atrLength": 29,
      "factor": 1
    },
    "value": 16.75780801626687,
    "state": "bull",
    "previousValue": 17.53097245241699,
    "previousState": "bull",
    "lastFlip": 1788134400000,
    "through": 1788134400000,
    "candles": 65,
    "note": "User-selected shared 15/2 preset: flip is 3.97% below the screenshot; calculated bullish reversal is August 31. Yahoo supplies only 65 completed weeks; screenshot history starts in 2018. Exact screenshot reversal date is not validated and four-year tests are unavailable."
  }
] as const;
