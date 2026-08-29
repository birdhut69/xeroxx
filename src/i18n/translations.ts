export type SupportedLanguage = 'en' | 'mr' | 'hi';

export interface Translations {
  // Brand & General
  brandName: string;
  brandTagline: string;
  customerMode: string;
  terminalMode: string;
  online: string;
  inRamSession: string;
  ramStatus: string;
  emergencyPurge: string;
  emergencyPurgeDesc: string;
  cancel: string;
  save: string;
  delete: string;
  close: string;
  copied: string;
  copyLink: string;
  loading: string;
  ready: string;

  // Scanner (Step 1)
  scanTitle: string;
  scanSubtitle: string;
  zeroTraceHandshake: string;
  initCamera: string;
  switchCamera: string;
  uploadScreenshot: string;
  refresh: string;
  pasteLinkPlaceholder: string;
  joinBtn: string;
  directWhatsAppShareTitle: string;
  directWhatsAppShareDesc: string;
  sharedDocReadyTitle: string;
  sharedDocReadySubtitle: string;
  scanStandeeToPrintNow: string;
  clear: string;
  encryptionBadge: string;
  keyExchangeBadge: string;
  storageBadge: string;
  urlFragment: string;
  zeroDiskRam: string;

  // Customer Chat Header & Controls
  customerNameLabel: string;
  customerNamePlaceholder: string;
  printSettingsTitle: string;
  disconnectTitle: string;
  lockNotice: string;
  onboardingStep1: string;
  onboardingStep1Desc: string;
  onboardingStep2: string;
  onboardingStep2Desc: string;
  onboardingStep3: string;
  onboardingStep3Desc: string;
  scanDocBtn: string;
  pickPdfBtn: string;

  // Quick Note Chips
  notePrefix: string;
  chipBw: string;
  chipDoubleSided: string;
  chipColor: string;
  chipUrgent: string;
  chipLegal: string;

  // Chat Input & Voice
  inputPlaceholder: string;
  attachDoc: string;
  liveCamera: string;
  gallery: string;
  settings: string;
  recordingVoice: string;
  cancelRecording: string;
  sendBtn: string;
  micTip: string;

  // Document Staging Tray
  stagingTitle: string;
  clearAll: string;
  maskIdBtn: string;
  sendFilesToRam: string;
  volatileRamSpool: string;
  stagedInMemory: string;

  // Document Status Badges
  statusEncrypting: string;
  statusSending: string;
  statusInShopRam: string;
  statusPrinting: string;
  statusPrinted: string;
  statusShredded: string;
  viewShredProof: string;

  // Camera Scanner Modal
  docCameraTitle: string;
  opticalScannerSubtitle: string;
  alignDocFrame: string;
  startingCamera: string;
  retake: string;
  maskIdPhoto: string;
  usePhoto: string;
  flipCameraTip: string;
  toggleFlash: string;

  // Crop & Redaction Studio
  studioTitle: string;
  studioSubtitle: string;
  tabCrop: string;
  tabMask: string;
  rotateBtn: string;
  dragCropTip: string;
  cutAndCropBtn: string;
  quickMaskZone: string;
  undoBtn: string;
  clearAllBoxes: string;
  saveChangesToRam: string;

  // Terminal Dashboard
  terminalHeaderTitle: string;
  terminalHeaderSubtitle: string;
  secureTransferCardTitle: string;
  encryptedRamBadge: string;
  pointPhoneTip: string;
  standeeBtn: string;
  searchPlaceholder: string;
  noCustomersActive: string;
  welcomeTerminalTitle: string;
  welcomeTerminalDesc: string;
  printDocBtn: string;
  deleteFromRamBtn: string;
  pageCounter: string;
  filterColor: string;
  filterGrayscale: string;
  filterPhotocopy: string;
  copiesLabel: string;

  // Destruction Certificate
  certTitle: string;
  certSubtitle: string;
  certVerifiedBadge: string;
  chainOfCustody: string;
  genesisBlock: string;
  ramIngestBlock: string;
  hardwareSpoolBlock: string;
  ramZeroizedBlock: string;
  downloadCertBtn: string;
  newPrintSession: string;

  // PWA Banner
  installPwaTitle: string;
  installPwaDesc: string;
  installBtn: string;
}

export const translations: Record<SupportedLanguage, Translations> = {
  en: {
    brandName: 'CipherPrint',
    brandTagline: 'Zero-Trace Ephemeral Print',
    customerMode: 'Customer',
    terminalMode: 'Terminal',
    online: 'Online',
    inRamSession: 'Printer RAM Handshake Active',
    ramStatus: '28 MB RAM • 0 Disk',
    emergencyPurge: 'Emergency Purge',
    emergencyPurgeDesc: 'Immediately zeroize all document memory in RAM',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    close: 'Close',
    copied: 'Copied',
    copyLink: 'Copy Link',
    loading: 'Loading...',
    ready: 'Ready',

    scanTitle: 'Scan Counter Standee QR',
    scanSubtitle: 'Point phone camera at Xerox shop QR standee to beam documents to printer RAM.',
    zeroTraceHandshake: 'Zero-Trace RAM Handshake',
    initCamera: 'Initializing Camera...',
    switchCamera: 'Switch Camera',
    uploadScreenshot: 'Upload QR Screenshot',
    refresh: 'Refresh',
    pasteLinkPlaceholder: 'Or paste pairing link with #key=...',
    joinBtn: 'Join',
    directWhatsAppShareTitle: 'Direct Share from WhatsApp',
    directWhatsAppShareDesc: 'Inside WhatsApp, tap any PDF/photo ➔ Share ➔ select CipherPrint to print in 1 tap!',
    sharedDocReadyTitle: 'Document Ready to Print',
    sharedDocReadySubtitle: 'Shared directly from WhatsApp / Storage',
    scanStandeeToPrintNow: 'Point camera at the Xerox Standee QR below to print now',
    clear: 'Clear',
    encryptionBadge: 'Encryption',
    keyExchangeBadge: 'Key Exchange',
    storageBadge: 'Storage',
    urlFragment: 'URL Fragment',
    zeroDiskRam: '0 KB Disk (RAM)',

    customerNameLabel: 'Customer Name',
    customerNamePlaceholder: 'Your Name (e.g. Rahul)',
    printSettingsTitle: 'Print & Security Settings',
    disconnectTitle: 'Disconnect from Counter',
    lockNotice: '🔒 End-to-end encrypted. Files decrypted in RAM only & zeroized after printing.',
    onboardingStep1: 'Attach Document',
    onboardingStep1Desc: 'Tap Paperclip or Camera below, or share directly from WhatsApp.',
    onboardingStep2: 'Add Instructions',
    onboardingStep2Desc: 'Type copies needed, double-sided preference, or record a voice note.',
    onboardingStep3: 'Destruction Proof',
    onboardingStep3Desc: 'Shopkeeper prints directly from RAM and issues a Merkle destruction proof.',
    scanDocBtn: 'Scan Document',
    pickPdfBtn: 'Pick PDF / File',

    notePrefix: 'Note:',
    chipBw: '🖨️ 1 B&W Copy',
    chipDoubleSided: '📑 Double-Sided',
    chipColor: '🎨 Full Color',
    chipUrgent: '⚡ Urgent Print',
    chipLegal: '📜 Legal Paper',

    inputPlaceholder: 'Message or Instructions...',
    attachDoc: 'Document(s)',
    liveCamera: 'Live Camera',
    gallery: 'Gallery',
    settings: 'Settings',
    recordingVoice: 'Recording Voice Note',
    cancelRecording: 'Cancel',
    sendBtn: 'Send',
    micTip: 'Tap to record voice note',

    stagingTitle: 'Ready to Send',
    clearAll: 'Clear All',
    maskIdBtn: 'Crop & Mask Sensitive ID Numbers',
    sendFilesToRam: 'Send to Xerox RAM (AES-256)',
    volatileRamSpool: '🔒 Volatile RAM Spool',
    stagedInMemory: 'Staged in browser memory',

    statusEncrypting: 'Encrypting',
    statusSending: 'Sending',
    statusInShopRam: 'In Shop RAM',
    statusPrinting: 'Printing...',
    statusPrinted: 'Printed',
    statusShredded: 'Shredded Proof',
    viewShredProof: 'Shredded Proof',

    docCameraTitle: 'Document Camera',
    opticalScannerSubtitle: 'In-Memory Optical Scanner',
    alignDocFrame: 'Align document inside frame',
    startingCamera: 'Starting Camera...',
    retake: 'Retake',
    maskIdPhoto: 'Mask ID',
    usePhoto: 'Use Photo',
    flipCameraTip: 'Flip Camera',
    toggleFlash: 'Toggle Flashlight',

    studioTitle: 'Crop & Redact Studio',
    studioSubtitle: 'Trim document edges & mask sensitive ID numbers',
    tabCrop: 'Crop & Trim',
    tabMask: 'Mask ID',
    rotateBtn: 'Rotate',
    dragCropTip: 'Drag corners to crop borders',
    cutAndCropBtn: 'Cut & Crop',
    quickMaskZone: 'Mask Number Zone',
    undoBtn: 'Undo',
    clearAllBoxes: 'Clear All',
    saveChangesToRam: 'Save Changes to RAM',

    terminalHeaderTitle: 'QuickXerox Terminal #01',
    terminalHeaderSubtitle: 'Connected • 28 MB RAM • 0 Disk',
    secureTransferCardTitle: 'Secure Transfer',
    encryptedRamBadge: 'Encrypted RAM',
    pointPhoneTip: 'Scan to send encrypted files',
    standeeBtn: 'Standee',
    searchPlaceholder: 'Search customer or document...',
    noCustomersActive: 'No active customers in queue',
    welcomeTerminalTitle: 'CipherPrint for Xerox & Print Shops',
    welcomeTerminalDesc: 'Zero-disk ephemeral transmission. Print documents directly from RAM without saving customer files to your desktop or downloads.',
    printDocBtn: 'Print Document',
    deleteFromRamBtn: 'Delete from RAM',
    pageCounter: 'Page',
    filterColor: 'Color',
    filterGrayscale: 'Grayscale',
    filterPhotocopy: 'Photocopy B&W',
    copiesLabel: 'Copies:',

    certTitle: 'Certificate of Cryptographic Destruction',
    certSubtitle: 'Verified Zero-Knowledge Purge Record',
    certVerifiedBadge: 'CRYPTOGRAPHICALLY VERIFIED • ZERO BYTES PERSISTED',
    chainOfCustody: 'Cryptographic Chain of Custody',
    genesisBlock: 'Block 0: Genesis Handshake',
    ramIngestBlock: 'Block 1: RAM Ingest & Key Exchange',
    hardwareSpoolBlock: 'Block 2: Hardware Print Spooling',
    ramZeroizedBlock: 'Block 3: Multi-Pass RAM Zeroization',
    downloadCertBtn: 'Download Digital Certificate (PNG)',
    newPrintSession: 'Start New Session',

    installPwaTitle: 'Install CipherPrint App',
    installPwaDesc: 'Enables 1-tap WhatsApp Direct Share',
    installBtn: 'Install',
  },

  mr: {
    brandName: 'सायफरप्रिंट',
    brandTagline: 'झिरो-डेटा सुरक्षित झेरॉक्स प्रिंट',
    customerMode: 'ग्राहक (Customer)',
    terminalMode: 'दुकानदार (Terminal)',
    online: 'सुरू (Online)',
    inRamSession: 'प्रिंटर RAM कनेक्शन सक्रिय',
    ramStatus: '२८ MB RAM • ० डिस्क',
    emergencyPurge: 'तातडीने नष्ट करा (Purge)',
    emergencyPurgeDesc: 'RAM मधील सर्व दस्तऐवज त्वरित नष्ट करा',
    cancel: 'रद्द करा',
    save: 'जतन करा',
    delete: 'हटवा',
    close: 'बंद करा',
    copied: 'कॉपी झाले',
    copyLink: 'लिंक कॉपी करा',
    loading: 'लोड होत आहे...',
    ready: 'तयार',

    scanTitle: 'काऊंटरवरील QR स्कॅन करा',
    scanSubtitle: 'कागदपत्रे सुरक्षितरीत्या प्रिंटर RAM मध्ये पाठवण्यासाठी फोन कॅमेऱ्याने QR स्कॅन करा.',
    zeroTraceHandshake: '१००% सुरक्षित RAM ट्रान्सफर',
    initCamera: 'कॅमेरा सुरू होत आहे...',
    switchCamera: 'कॅमेरा बदला',
    uploadScreenshot: 'QR चा स्क्रीनशॉट अपलोड करा',
    refresh: 'रिफ्रेश',
    pasteLinkPlaceholder: 'किंवा #key= असलेली लिंक येथे पेस्ट करा...',
    joinBtn: 'जोडा',
    directWhatsAppShareTitle: 'WhatsApp वरून थेट पाठवा',
    directWhatsAppShareDesc: 'WhatsApp मध्ये PDF किंवा फोटो उघडा ➔ शेअर (📤) दाबा ➔ CipherPrint निवडा!',
    sharedDocReadyTitle: 'दस्तऐवज प्रिंटसाठी तयार आहे',
    sharedDocReadySubtitle: 'WhatsApp / स्टोरेजमधून थेट प्राप्त झाले',
    scanStandeeToPrintNow: 'प्रिंट करण्यासाठी खालील झेरॉक्स स्टँडी QR स्कॅन करा',
    clear: 'साफ करा',
    encryptionBadge: 'एनक्रिप्शन',
    keyExchangeBadge: 'की एक्सचेंज',
    storageBadge: 'स्टोरेज',
    urlFragment: 'URL फ्रॅगमेंट',
    zeroDiskRam: '० KB डिस्क (RAM)',

    customerNameLabel: 'ग्राहकाचे नाव',
    customerNamePlaceholder: 'तुमचे नाव (उदा. राहुल)',
    printSettingsTitle: 'प्रिंट आणि सुरक्षा सेटिंग्ज',
    disconnectTitle: 'काऊंटरवरून डिस्कनेक्ट करा',
    lockNotice: '🔒 पूर्णपणे एनक्रिप्टेड. फाईल्स फक्त RAM मध्ये उघडल्या जातात आणि प्रिंटनंतर नष्ट होतात.',
    onboardingStep1: 'कागदपत्र जोडा',
    onboardingStep1Desc: 'खालील पेपरक्लिप किंवा कॅमेरा दाबा, किंवा WhatsApp वरून थेट शेअर करा.',
    onboardingStep2: 'सूचना द्या',
    onboardingStep2Desc: 'आवश्यक प्रती (Copies), दोन्ही बाजू किंवा व्हॉईस मेसेज पाठवा.',
    onboardingStep3: 'नष्ट केल्याचा पुरावा',
    onboardingStep3Desc: 'दुकानदार थेट RAM मधून प्रिंट करतो आणि नष्ट केल्याचा पुरावा मिळतो.',
    scanDocBtn: 'कागदपत्र स्कॅन करा',
    pickPdfBtn: 'PDF / फाईल निवडा',

    notePrefix: 'नोंद:',
    chipBw: '🖨️ १ कृष्णधवल (B&W) प्रत',
    chipDoubleSided: '📑 दोन्ही बाजू (Double-Sided)',
    chipColor: '🎨 रंगीत प्रिंट (Color)',
    chipUrgent: '⚡ तातडीने प्रिंट (Urgent)',
    chipLegal: '📜 लीगल पेपर',

    inputPlaceholder: 'कागदपत्राबद्दल सूचना लिहा...',
    attachDoc: 'दस्तऐवज (PDF)',
    liveCamera: 'लाईव्ह कॅमेरा',
    gallery: 'गॅलरी',
    settings: 'सेटिंग्ज',
    recordingVoice: 'व्हॉईस नोट रेकॉर्ड होत आहे',
    cancelRecording: 'रद्द करा',
    sendBtn: 'पाठवा',
    micTip: 'व्हॉईस नोटसाठी टॅप करा',

    stagingTitle: 'पाठवण्यासाठी तयार',
    clearAll: 'सर्व काढा',
    maskIdBtn: 'क्रॉप करा आणि आधार/ID नंबर लपवा',
    sendFilesToRam: 'झेरॉक्स RAM मध्ये सुरक्षित पाठवा (AES-256)',
    volatileRamSpool: '🔒 सुरक्षित RAM स्पूल',
    stagedInMemory: 'ब्राउझर मेमरीमध्ये तात्पुरते साठवले',

    statusEncrypting: 'एनक्रिप्ट होत आहे...',
    statusSending: 'पाठवत आहे...',
    statusInShopRam: 'दुकानदार RAM मध्ये आले',
    statusPrinting: 'प्रिंट होत आहे...',
    statusPrinted: 'प्रिंट झाले',
    statusShredded: 'नष्ट केल्याचा पुरावा',
    viewShredProof: 'नष्ट केल्याचा पुरावा',

    docCameraTitle: 'डॉक्युमेंट कॅमेरा',
    opticalScannerSubtitle: 'ऑप्टिकल स्कॅनर (RAM मध्ये)',
    alignDocFrame: 'कागदपत्र फ्रेममध्ये व्यवस्थित ठेवा',
    startingCamera: 'कॅमेरा सुरू होत आहे...',
    retake: 'पुन्हा काढा',
    maskIdPhoto: 'ID लपवा',
    usePhoto: 'हा फोटो वापरा',
    flipCameraTip: 'कॅमेरा फ्लिप करा',
    toggleFlash: 'फ्लॅशलाईट चालू/बंद',

    studioTitle: 'क्रॉप आणि मास्किंग स्टुडिओ',
    studioSubtitle: 'कागदपत्राच्या कडा छाटा आणि खाजगी नंबर लपवा',
    tabCrop: 'क्रॉप आणि ट्रिम',
    tabMask: 'ID नंबर लपवा',
    rotateBtn: 'फिरवा (Rotate)',
    dragCropTip: 'कडा छाटण्यासाठी कोपरे ओढा',
    cutAndCropBtn: 'कापा आणि क्रॉप करा',
    quickMaskZone: 'नंबर झोन लपवा',
    undoBtn: 'पूर्ववत करा',
    clearAllBoxes: 'सर्व पुसा',
    saveChangesToRam: 'बदल RAM मध्ये सेव्ह करा',

    terminalHeaderTitle: 'क्विकझेरॉक्स टर्मिनल #०१',
    terminalHeaderSubtitle: 'कनेक्टेड • २८ MB RAM • ० डिस्क',
    secureTransferCardTitle: 'सुरक्षित ट्रान्सफर',
    encryptedRamBadge: 'एनक्रिप्टेड RAM',
    pointPhoneTip: 'फाईल्स पाठवण्यासाठी स्कॅन करा',
    standeeBtn: 'स्टँडी',
    searchPlaceholder: 'ग्राहक किंवा दस्तऐवज शोधा...',
    noCustomersActive: 'सध्या रांगेत कोणीही ग्राहक नाही',
    welcomeTerminalTitle: 'झेरॉक्स आणि प्रिंट दुकानांसाठी सायफरप्रिंट',
    welcomeTerminalDesc: 'झिरो-डिस्क ट्रान्सफर. ग्राहकांच्या फाईल्स कॉम्प्युटरवर सेव्ह न करता थेट RAM मधून प्रिंट करा.',
    printDocBtn: 'दस्तऐवज प्रिंट करा',
    deleteFromRamBtn: 'RAM मधून नष्ट करा',
    pageCounter: 'पान',
    filterColor: 'रंगीत (Color)',
    filterGrayscale: 'ग्रेस्केल',
    filterPhotocopy: 'झेरॉक्स B&W',
    copiesLabel: 'प्रती (Copies):',

    certTitle: 'कागदपत्र सुरक्षितपणे नष्ट केल्याचे प्रमाणपत्र',
    certSubtitle: 'झिरो-डेटा पुष्टीकरण अहवाल',
    certVerifiedBadge: 'क्रिप्टोग्राफिकली सत्यापित • कॉम्प्युटरवर शून्य डेटा शिल्लक',
    chainOfCustody: 'क्रिप्टोग्राफिक ऑडिट ट्रेल',
    genesisBlock: 'ब्लॉक ०: जेनेसिस हँडशेक',
    ramIngestBlock: 'ब्लॉक १: RAM मध्ये की एक्सचेंज',
    hardwareSpoolBlock: 'ब्लॉक २: हार्डवेअर प्रिंट स्पूलिंग',
    ramZeroizedBlock: 'ब्लॉक ३: मेमरीमधून कायमचे नष्ट',
    downloadCertBtn: 'प्रमाणपत्र डाउनलोड करा (PNG)',
    newPrintSession: 'नवीन सत्र सुरू करा',

    installPwaTitle: 'सायफरप्रिंट ॲप इन्स्टॉल करा',
    installPwaDesc: 'WhatsApp वरून १-टॅप डायरेक्ट शेअर सुरू होते',
    installBtn: 'इन्स्टॉल',
  },

  hi: {
    brandName: 'साइफरप्रिंट',
    brandTagline: 'ज़ीरो-डेटा सुरक्षित ज़ेरॉक्स प्रिंट',
    customerMode: 'ग्राहक (Customer)',
    terminalMode: 'दुकानदार (Terminal)',
    online: 'ऑनलाइन (Online)',
    inRamSession: 'प्रिंटर RAM कनेक्शन सक्रिय',
    ramStatus: '२८ MB RAM • ० डिस्क',
    emergencyPurge: 'तुरंत नष्ट करें (Purge)',
    emergencyPurgeDesc: 'RAM से सभी दस्तावेज़ तुरंत नष्ट करें',
    cancel: 'रद्द करें',
    save: 'सहेजें',
    delete: 'हटाएं',
    close: 'बंद करें',
    copied: 'कॉपी किया गया',
    copyLink: 'लिंक कॉपी करें',
    loading: 'लोड हो रहा है...',
    ready: 'तैयार',

    scanTitle: 'काउंटर का QR स्कैन करें',
    scanSubtitle: 'फ़ाइलें सीधे प्रिंटर RAM में भेजने के लिए फ़ोन कैमरे से QR कोड स्कैन करें।',
    zeroTraceHandshake: '१००% सुरक्षित RAM ट्रांसफर',
    initCamera: 'कैमरा शुरू हो रहा है...',
    switchCamera: 'कैमरा बदलें',
    uploadScreenshot: 'QR का स्क्रीनशॉट अपलोड करें',
    refresh: 'रिफ्रेश',
    pasteLinkPlaceholder: 'या #key= वाला लिंक यहाँ पेस्ट करें...',
    joinBtn: 'जुड़ें',
    directWhatsAppShareTitle: 'WhatsApp से सीधे भेजें',
    directWhatsAppShareDesc: 'WhatsApp में PDF/फ़ोटो खोलें ➔ शेयर (📤) दबाएं ➔ CipherPrint चुनें!',
    sharedDocReadyTitle: 'दस्तावेज़ प्रिंट के लिए तैयार है',
    sharedDocReadySubtitle: 'WhatsApp / स्टोरेज से सीधे प्राप्त हुआ',
    scanStandeeToPrintNow: 'प्रिंट करने के लिए नीचे ज़ेरॉक्स स्टैंडी QR स्कैन करें',
    clear: 'हटाएं',
    encryptionBadge: 'एन्क्रिप्शन',
    keyExchangeBadge: 'की एक्सचेंज',
    storageBadge: 'स्टोरेज',
    urlFragment: 'URL फ्रैगमेंट',
    zeroDiskRam: '० KB डिस्क (RAM)',

    customerNameLabel: 'ग्राहक का नाम',
    customerNamePlaceholder: 'आपका नाम (उदा. राहुल)',
    printSettingsTitle: 'प्रिंट और सुरक्षा सेटिंग्स',
    disconnectTitle: 'काउंटर से डिस्कनेक्ट करें',
    lockNotice: '🔒 पूर्णतः एन्क्रिप्टेड। फ़ाइलें केवल RAM में खुलती हैं और प्रिंट के बाद नष्ट हो जाती हैं।',
    onboardingStep1: 'दस्तावेज़ जोड़ें',
    onboardingStep1Desc: 'नीचे पेपरक्लिप या कैमरा दबाएं, या WhatsApp से सीधे शेयर करें।',
    onboardingStep2: 'निर्देश दें',
    onboardingStep2Desc: 'ज़रूरी प्रतियां (Copies), दोनों तरफ या वॉयस मैसेज भेजें।',
    onboardingStep3: 'नष्ट करने का प्रमाण',
    onboardingStep3Desc: 'दुकानदार सीधे RAM से प्रिंट करता है और नष्ट करने का प्रमाण मिलता है।',
    scanDocBtn: 'दस्तावेज़ स्कैन करें',
    pickPdfBtn: 'PDF / फ़ाइल चुनें',

    notePrefix: 'नोट:',
    chipBw: '🖨️ १ ब्लैक & व्हाइट (B&W) कॉपी',
    chipDoubleSided: '📑 दोनों तरफ (Double-Sided)',
    chipColor: '🎨 रंगीन प्रिंट (Color)',
    chipUrgent: '⚡ तुरंत प्रिंट (Urgent)',
    chipLegal: '📜 लीगल पेपर',

    inputPlaceholder: 'दस्तावेज़ के बारे में निर्देश लिखें...',
    attachDoc: 'दस्तावेज़ (PDF)',
    liveCamera: 'लाइव कैमरा',
    gallery: 'गैलरी',
    settings: 'सेटिंग्स',
    recordingVoice: 'वॉयस नोट रिकॉर्ड हो रहा है',
    cancelRecording: 'रद्द करें',
    sendBtn: 'भेजें',
    micTip: 'वॉयस नोट के लिए टैप करें',

    stagingTitle: 'भेजने के लिए तैयार',
    clearAll: 'सभी हटाएं',
    maskIdBtn: 'क्रॉप करें और आधार/ID नंबर छिपाएं',
    sendFilesToRam: 'ज़ेरॉक्स RAM में सुरक्षित भेजें (AES-256)',
    volatileRamSpool: '🔒 सुरक्षित RAM स्पूल',
    stagedInMemory: 'ब्राउज़र मेमोरी में अस्थायी रूप से रखा गया',

    statusEncrypting: 'एन्क्रिप्ट हो रहा है...',
    statusSending: 'भेज रहा है...',
    statusInShopRam: 'दुकानदार RAM में पहुंचा',
    statusPrinting: 'प्रिंट हो रहा है...',
    statusPrinted: 'प्रिंट हो गया',
    statusShredded: 'नष्ट करने का प्रमाण',
    viewShredProof: 'नष्ट करने का प्रमाण',

    docCameraTitle: 'डॉक्यूमेंट कैमरा',
    opticalScannerSubtitle: 'ऑप्टिकल स्कैनर (RAM में)',
    alignDocFrame: 'दस्तावेज़ को फ्रेम के अंदर रखें',
    startingCamera: 'कैमरा शुरू हो रहा है...',
    retake: 'दोबारा लें',
    maskIdPhoto: 'ID छिपाएं',
    usePhoto: 'यह फ़ोटो लें',
    flipCameraTip: 'कैमरा बदलें',
    toggleFlash: 'फ्लैशलाइट चालू/बंद',

    studioTitle: 'क्रॉप और मास्किंग स्टूडियो',
    studioSubtitle: 'दस्तावेज़ के किनारे काटें और निजी नंबर छिपाएं',
    tabCrop: 'क्रॉप और ट्रिम',
    tabMask: 'ID नंबर छिपाएं',
    rotateBtn: 'घुमाएं (Rotate)',
    dragCropTip: 'किनारे काटने के लिए कोने खींचें',
    cutAndCropBtn: 'काटें और क्रॉप करें',
    quickMaskZone: 'नंबर ज़ोन छिपाएं',
    undoBtn: 'पूर्ववत करें (Undo)',
    clearAllBoxes: 'सभी मिटाएं',
    saveChangesToRam: 'बदलाव RAM में सहेजें',

    terminalHeaderTitle: 'क्विकज़ेरॉक्स टर्मिनल #०१',
    terminalHeaderSubtitle: 'कनेक्टेड • २८ MB RAM • ० डिस्क',
    secureTransferCardTitle: 'सुरक्षित ट्रांसफर',
    encryptedRamBadge: 'एन्क्रिप्टेड RAM',
    pointPhoneTip: 'फ़ाइलें भेजने के लिए स्कैन करें',
    standeeBtn: 'स्टैंडी',
    searchPlaceholder: 'ग्राहक या दस्तावेज़ खोजें...',
    noCustomersActive: 'कतार में कोई सक्रिय ग्राहक नहीं है',
    welcomeTerminalTitle: 'ज़ेरॉक्स और प्रिंट दुकानों के लिए साइफरप्रिंट',
    welcomeTerminalDesc: 'ज़ीरो-डिस्क ट्रांसफर। ग्राहक की फ़ाइलें कंप्यूटर पर सहेजे बिना सीधे RAM से प्रिंट करें।',
    printDocBtn: 'दस्तावेज़ प्रिंट करें',
    deleteFromRamBtn: 'RAM से नष्ट करें',
    pageCounter: 'पेज',
    filterColor: 'रंगीन (Color)',
    filterGrayscale: 'ग्रेस्केल',
    filterPhotocopy: 'ज़ेरॉक्स B&W',
    copiesLabel: 'प्रतियां (Copies):',

    certTitle: 'दस्तावेज़ सुरक्षित रूप से नष्ट करने का प्रमाण पत्र',
    certSubtitle: 'ज़ीरो-डेटा पुष्टिकरण रिकॉर्ड',
    certVerifiedBadge: 'क्रिप्टोग्राफिक रूप से सत्यापित • कंप्यूटर पर शून्य डेटा शेष',
    chainOfCustody: 'क्रिप्टोग्राफिक ऑडिट ट्रेल',
    genesisBlock: 'ब्लॉक ०: जेनेसिस हैंडशेक',
    ramIngestBlock: 'ब्लॉक १: RAM में की एक्सचेंज',
    hardwareSpoolBlock: 'ब्लॉक २: हार्डवेयर प्रिंट स्पूलिंग',
    ramZeroizedBlock: 'ब्लॉक ३: मेमोरी से हमेशा के लिए नष्ट',
    downloadCertBtn: 'प्रमाण पत्र डाउनलोड करें (PNG)',
    newPrintSession: 'नया सत्र शुरू करें',

    installPwaTitle: 'साइफरप्रिंट ऐप इंस्टॉल करें',
    installPwaDesc: 'WhatsApp से १-टैप डायरेक्ट शेयर सक्षम करता है',
    installBtn: 'इंस्टॉल',
  },
};
