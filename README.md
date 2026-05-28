# 🛡️ MailSentinel — Browser Extension for Email Security

> An AI-powered Browser extension that detects phishing emails in real time using machine learning, rule-based analysis, and the Google Safe Browsing API.

---

## 📖 Overview

MailSentinel is a browser extension that analyzes emails on Gmail and Outlook Web to determine whether they are safe or potential phishing attempts. Rather than a simple spam label, it produces a **Trust Score (0–100)** backed by three complementary detection layers, giving users transparent, actionable insight at the moment of interaction.

---

## ✨ Features

- **Multi-Layered Detection**: Combines NLP classification, rule-based heuristics, and live URL threat intelligence
- **Trust Score Framework**: A weighted score instead of a binary safe/unsafe verdict
- **Color-Coded Risk Levels**: Instant visual feedback for every email analyzed
- **URL Security Analysis**: Every embedded link is scanned and highlighted (safe = green, suspicious = red, Google SB flagged = `SB` badge)
- **Contextual Explanations**: Tells you *why* an email was flagged (e.g. poor grammar, urgency language, suspicious domain)
- **Gmail & Outlook Support**: Works across both major webmail platforms

---

## 🎯 Trust Score Levels

| Score | Level | Color |
|-------|-------|-------|
| 85–100 | Safe | 🟢 Green |
| 70–84 | Likely Safe | 🟩 Light Green |
| 55–69 | Suspicious | 🟡 Yellow |
| 40–54 | Risky | 🟠 Orange |
| 20–39 | High Risk | 🔴 Red |
| 0–19 | Dangerous | 🟥 Dark Red |

---

## 🏗️ Architecture

The system uses a three-tiered architecture:

```
Browser Extension (Manifest V3)
    └── content.js       — Extracts sender, subject, body, URLs from Gmail/Outlook DOM
    └── popup.js         — Displays Trust Score, URL analysis, and threat explanations
          │
          ▼ JSON (sender, subject, body, URLs)
FastAPI Backend (Python)
    ├── Rule-Based Analyzer   (weight: 20%)
    ├── NLP Classifier        (weight: 50%)
    └── Google Safe Browsing  (weight: 30%)
          │
          ▼ Trust Score + Threat Breakdown
Popup UI — Color-coded results rendered in the browser
```

### Trust Score Formula

```
Combined Risk  = (ML Score × 0.50) + (API Score × 0.30) + (Rules Score × 0.20)
Final Score    = 100 − Combined Risk
```

---

## 🧠 Detection Layers

### 1. NLP Classifier (50%)
- Trained on **42,000+ labeled emails** (SpamAssassin + CEAS_08 datasets)
- TF-IDF vectorization + supervised classifier
- Outputs a spam probability converted to a 0–100 risk score

### 2. Google Safe Browsing API (30%)
- All embedded URLs are checked against Google's live threat database
- Detects malicious domains in real time, including zero-day phishing URLs
- API Score = `(malicious URLs ÷ total URLs) × 100`

### 3. Rule-Based Analysis (20%)
- Lightweight Python heuristics evaluating:

| Component | Triggers | Weight |
|-----------|----------|--------|
| Subject | Urgency keywords, ALL-CAPS, excessive punctuation | 20% |
| Sender | Domain spoofing, suspicious TLDs, numeric domains | 30% |
| Body | Credential requests, poor grammar, generic greetings | 35% |
| URLs | Shorteners, obfuscated links, mismatched domains | 15% |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Browser Extension | JavaScript (ES6), Manifest V3 |
| Backend | Python 3.10, FastAPI 0.95.0 |
| Machine Learning | Scikit-learn, TF-IDF Vectorizer |
| External API | Google Safe Browsing API v4 |
| Frontend | HTML, CSS, JavaScript |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Google Chrome
- A [Google Safe Browsing API key](https://developers.google.com/safe-browsing/)

### 1. Clone the repository

```bash
git clone https://github.com/engrarslan99/email-sentinel.git
cd mailsentinel
```

### 2. Set up the backend

```bash
cd backend
pip install -r requirements.txt
```

Add your Google Safe Browsing API key to the environment:

```bash
export SAFE_BROWSING_API_KEY=your_api_key_here
```

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

The backend will run at `http://127.0.0.1:8000`. You can verify it's working at `/health`.

### 3. Load the Chrome extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked** and select the `extension/` folder
4. The MailSentinel icon will appear in your toolbar

### 4. Use it

1. Open Gmail or Outlook in Chrome
2. Click on any email
3. Click the MailSentinel extension icon
4. View the Trust Score, risk level, and URL analysis

---

## 🧪 Testing Results

| Component | Accuracy |
|-----------|----------|
| ML Classifier | 85% on test dataset |
| Google Safe Browsing | 100% on known malicious URLs |
| Rule-Based Analysis | 92% effectiveness on suspicious patterns |
| Standard URL Detection | 98% accuracy |

---

## ⚠️ Limitations

- The backend must be running locally (or hosted) for the extension to function
- Outlook DOM extraction is more complex than Gmail due to dynamic rendering
- The Google Safe Browsing API has rate limits that may affect large-scale use
- The NLP model may occasionally flag legitimate marketing emails as suspicious
- Tested primarily on Google Chrome; Firefox and Edge support may require additional testing
- The `data/` folder (training dataset) is not included in this repository due to file size. Download the datasets from the links in the References section below

---

## 🔮 Future Work

- Firefox, Edge, and Safari support
- BERT / Transformer-based NLP models for higher detection accuracy
- Cloud-hosted backend to remove local dependency
- Proactive cybersecurity education notifications
- Microsoft Graph API integration as an optional Outlook fallback

---

## 📚 References

Key datasets and APIs used in this project:

- [SpamAssassin Public Corpus](https://spamassassin.apache.org/old/publiccorpus/)
- [CEAS 2008 Spam Dataset](http://www.ceas.cc/2008/)
- [Google Safe Browsing API](https://developers.google.com/safe-browsing/)
- Verizon 2023 Data Breach Investigations Report.

---

## 👤 Author

**Muhammad Arslan Ashfaq**  
MSc in Computing — Griffith College Dublin  
Supervised by Ahmed Olalekan  
September 2025

---

## 📄 License

This project was developed as an academic thesis. Please contact the author before reusing or redistributing any part of this work.
