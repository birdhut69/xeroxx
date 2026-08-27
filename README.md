# 🛡️ SafePrint — Zero-Trust Ephemeral & Encrypted Print Platform

> **Eliminating Document Theft & Privacy Leaks at Xerox & Print Shops.**

SafePrint is a zero-trust, end-to-end encrypted (E2EE), blockchain-inspired ephemeral web platform. It replaces dangerous workflows (such as sending Aadhaar cards, passports, marksheets, and bank statements over WhatsApp or email to print shops) with a cryptographically secure, zero-retention in-memory print pipeline.

---

## 🚀 Key Architectural Innovations

1. **Zero Server Disk Persistence:** The relay server acts strictly as an in-memory streaming pipe. Zero bytes of documents or keys are ever written to disk or databases.
2. **Zero-Knowledge Handshake via URL Hash (`#key=...`):** AES-256 session keys are encoded inside the QR code's URL hash fragment. Per RFC 3986, hash fragments are never sent to the server in HTTP requests.
3. **Sandboxed DRM Canvas Workspace:** Documents decrypted on the shopkeeper's terminal render directly inside HTML5 Canvas buffers. No raw `<img src>`, `<a download>`, or file handles exist in the DOM. Context menus, `Ctrl+S`, `Ctrl+U`, `F12`, and drag-and-drop are intercepted and blocked.
4. **Dynamic Forensic Watermark Grid:** Renders an anti-leak watermark (Shop ID, Session Hash, Real-time Timestamp) across the canvas to deter and trace camera phone photographs.
5. **Client-Side Privacy Redaction Studio:** Customers can draw blackout privacy masks over Aadhaar numbers, PAN, or signatures on their phones *before* encryption.
6. **Hardware & RAM Memory Zeroization:** When printing completes (or upon auto-destruct countdown), all memory buffers and TypedArrays are actively overwritten with random entropy and zeroed (`crypto.getRandomValues()` & `view.fill(0)`).
7. **Ephemeral Blockchain Merkle Ledger:** Logs a 4-block cryptographic audit chain (Genesis $\to$ Ingest $\to$ Print $\to$ Shred) and sends an immutable **Certificate of Destruction** back to the customer's phone.

---

## ⚡ Quick Start & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Security Audit Tests
```bash
npx tsx test/security-audit.test.ts
```

### 3. Start SafePrint (Frontend + In-Memory Relay)
```bash
npm run dev
```
- **Web App (Vite):** `http://localhost:5173`
- **Zero-Storage Relay Server:** `http://localhost:8080` (WebSocket on `/ws`)

---

## 📱 Interactive Modes

- **⚡ Dual Live Demo Simulator (`/`):** Test both the Shopkeeper Terminal and Customer Mobile Phone side-by-side in one browser window with live real-time WebSocket communication and synthetic document generation.
- **🖥️ Xerox Terminal View (`/terminal`):** The desktop interface for the print shop operator with dynamic holographic QR generator, DRM canvas, editor, safe print engine, and memory shredder.
- **📱 Customer Mobile PWA (`/?room=UUID#key=KEY`):** The zero-install mobile web application launched when scanning the QR code, featuring client-side E2EE encryption, redaction studio, and destruction certificates.

---

## 🔐 Cryptographic Specification

| Component | Standard |
| :--- | :--- |
| **Symmetric Cipher** | AES-GCM-256 (Authenticated Encryption with 12-byte IV) |
| **Document Fingerprint** | SHA-256 Digest |
| **Key Transport** | Client-only URL Hash Fragment (`#key=BASE64URL`) |
| **Memory Scrubbing** | Cryptographic PRNG Scramble + Zero Fill |
| **Audit Ledger** | SHA-256 Merkle Block Chain with Root Proof Hash |

---

## 📄 License
MIT License. Built for privacy, confidentiality, and zero-trust print workflows.
