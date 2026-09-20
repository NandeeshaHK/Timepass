# **PWA Markdown Story Reader Architecture**

[https://gemini.google.com/app/244b659a795c1125](https://gemini.google.com/app/244b659a795c1125)

&nbsp;

*User prompt: I want you to make a free website for reading markdown stories, very minimal github io pages. Stories has to be loaded from the private and secure repo or something has to be thought. Page should be installable to the homescreen.  Front page should show the stories available, and use the cookies and site storages to save the story progress, and the font size should be readable from far, and should work for the old people. Each page should be few lines, with proper formatting with both the light and dark modes, use skin tone or night light with tones and shades of brown for both the light and dark themes. no fancy emojis, and all. Use professional and modern icons which goes well.  A continue option when loaded again, and it should start where they left the story.  For all these, give the architecture and tech stack i will review it, before going forward.*

Response: Here is a proposed architecture and tech stack tailored to your requirements for a highly accessible, minimal, and secure Markdown reader.

### **1\. Architecture: The "Secure Private-to-Public" Pipeline**

Since GitHub Pages requires the publishing repository to be public (on free tiers), fetching directly from a private repository via the browser would require exposing a GitHub Token—which is a major security risk. Here is the safest architecture:

> * **Content Repository (Private):** You store your Markdown stories in a private GitHub repository. Only you have access.  
> * **The Bridge (GitHub Actions):** We use a GitHub Action in your private repository. Whenever you add a new story, the Action automatically parses the Markdown, bundles it, and pushes the compiled, static app to a **separate Public Repository** that hosts the GitHub Pages site.  
> * **The App (Public GitHub Pages):** The final website is a 100% static Single Page Application (SPA). It contains no sensitive tokens, just the text of the stories you chose to publish.

### **2\. Proposed Tech Stack**

To keep it blazing fast, minimal, and dependency-light:

> * **Core Framework:** **Vite \+ Vanilla JavaScript (or Preact)**. Vite provides a fast build process. Vanilla JS or Preact keeps the bundle tiny and fast, especially on older devices.  
> * **Markdown Parsing:** **Marked.js** combined with **DOMPurify**. Marked will convert your markdown to HTML, and DOMPurify ensures no malicious scripts run (crucial for security).  
> * **PWA (Installability):** **Vite PWA Plugin**. This handles the manifest.json (for the "Add to Homescreen" prompt) and sets up a Service Worker so the app can work offline.  
> * **Data Storage:** **Browser localStorage**. Cookies are meant for server communication. localStorage is completely private, stays on the user's device, and easily handles saving the exact line/page where they left off.  
> * **Icons:** **Lucide Icons**. Clean, modern, highly legible SVG icons. No emojis, strictly professional.  
> * **Styling:** **Vanilla CSS with CSS Variables**. This allows us to easily switch between Light and Dark mode using your requested sepia/brown color palettes without heavy CSS frameworks.

### **3\. Core Feature Logic**

> * **Pagination (A few lines per page):** Instead of pre-generating hundreds of HTML pages, the JavaScript will load the chosen story, split the parsed HTML by paragraphs (\<p\>), and display them in "chunks" (e.g., 3-4 paragraphs per screen).  
> * **Progress Tracking:** When a user clicks "Next Page," the app updates localStorage with a key like story\_\[id\]\_progress: chunk\_4.  
> * **The "Continue" Button:** On the front page, the app checks localStorage. If progress exists, it generates a prominent "Continue reading \[Story Name\]" button that routes directly to their saved chunk.

### **4\. UI/UX & Accessibility (Aimed at Older Demographics)**

> * **Typography:** Large, highly legible sans-serif or slab-serif fonts (like *Inter* or *Merriweather*). High contrast base sizes (e.g., 1.25rem minimum).  
> * **Color Palette (Eye-friendly):**  
  * *Light Mode:* Warm parchment background (very light cream/brown), dark espresso text.  
  * *Dark Mode:* Deep mocha background, soft sand/latte text. (Reduces blue light, easy on aging eyes).  
> * **Interaction:** Large tap targets for buttons (Next, Previous, Home). Swipe gestures for turning pages.

**Does this architecture and tech stack align with your vision?** Let me know if you approve or if you'd like to adjust anything (like switching to React/Vue instead of Vanilla JS), and I will proceed with generating the code structure and logic.

---

*User prompt: I don't want new repos, and separate pages for each single story.*

Response: Understood. We will use exactly **one repository** and build a true **Single Page Application (SPA)** where everything runs through a single index.html file.

To achieve privacy on a single GitHub Pages repository (which must be public on free accounts), we will encrypt the stories locally before they are pushed.

Here is the revised architecture and tech stack:

### **1\. Architecture: The Encrypted Single-Page App**

> * **One Repository:** You maintain a single GitHub repository that hosts the website.  
> * **Security (Client-Side Encryption):** You write your Markdown files locally. Before pushing to GitHub, a small local Node.js script bundles all your Markdown stories into a single, AES-encrypted JSON file. The raw Markdown is added to your .gitignore and never uploaded.  
> * **Accessing Stories:** When you (or an authorized user) open the website, a minimal prompt asks for the decryption passphrase. Once entered, the stories are decrypted in the browser's memory.  
> * **Single Page App (No separate pages):** The app consists of exactly one index.html. JavaScript dynamically swaps the front page UI out for the reader UI when a story is clicked.

### **2\. Revised Tech Stack**

> * **Framework:** **Vite \+ Vanilla JavaScript**. Keeps the bundle incredibly small and fast.  
> * **Security:** **CryptoJS**. A lightweight library to handle AES decryption in the browser.  
> * **Markdown Parsing:** **Marked.js** \+ **DOMPurify**. Converts Markdown to HTML and strips any malicious code.  
> * **PWA (Homescreen Install):** **Vite PWA Plugin**. Handles the service worker for offline caching and the manifest for the "Add to Homescreen" functionality.  
> * **State & Progress:** **Browser localStorage**. Will securely save the decryption passphrase (so it only needs to be entered once per device) and the user's reading progress (e.g., { storyId: "story-1", chunkIndex: 5 }).  
> * **Icons:** **Lucide Icons** (SVG format). Professional, clean, and scalable.  
> * **Styling:** **Vanilla CSS**.

### **3\. Application Flow & Logic**

> 1. **Boot & Auth:** User opens the app. It checks localStorage for the passphrase. If missing, it prompts for it.  
> 2. **Home Screen:** The app decrypts the JSON and lists the available stories. It checks localStorage for reading progress and displays a "Continue \[Story Title\]" button at the very top.  
> 3. **Reading View:** When a story is selected, JavaScript parses the Markdown, splits the HTML into readable chunks (3-4 paragraphs), and displays the first chunk.  
> 4. **Pagination:** Large, accessible "Previous" and "Next" buttons at the bottom of the screen allow navigation. Clicking "Next" updates the chunk index in localStorage.

### **4\. Accessibility & UI**

> * **Color Themes (CSS Variables):**  
  * *Light:* \#F4EFE6 (warm paper background), \#3E2723 (dark brown text).  
  * *Dark:* \#2D231E (deep brown background), \#D7CCC8 (soft latte text).  
> * **Typography:** A highly readable system font stack (like San Francisco, Segoe UI, or Roboto) with a base size of 1.25rem (20px) and a 1.6 line height to ensure readability for older eyes.

This eliminates the need for multiple repositories and ensures you don't have a tangled mess of HTML files, while keeping your stories entirely secure from public scraping.

Does this single-repo, encrypted approach solve the constraints for you?

---

*User prompt: what if there many stories, everthing will be downloaded in the device on the first view? it will make the loading website very slow right?*

Response: You are spot on. Bundling all stories into a single file would create a heavy initial download, burn mobile data, and slow down older devices trying to decrypt a huge payload in memory.

The solution is **On-Demand (Lazy) Loading** with split files.

### **The On-Demand Architecture**

Instead of one monolithic encrypted file, we split the content into two distinct parts during the build step:

public/  
├── index.html  
├── catalog.json.enc       \<-- Tiny: titles, IDs, summaries (\~10–20 KB)  
└── stories/  
&nbsp;&nbsp;&nbsp;&nbsp;├── story-001.enc      \<-- Downloaded only when opened (\~15–30 KB)  
&nbsp;&nbsp;&nbsp;&nbsp;├── story-002.enc  
&nbsp;&nbsp;&nbsp;&nbsp;└── story-003.enc

#### **1\. Initial Page Load (Lightweight & Instant)**

> * When the user opens the website, the browser downloads only the app shell (index.html, minimal CSS/JS) and catalog.json.enc.  
> * The catalog contains only high-level metadata: title, unique ID, estimated read time, and brief synopsis.  
> * Even with 500 stories, this index file is roughly 30–50 KB compressed. The initial home screen renders in milliseconds, even on a slow 3G connection.

#### **2\. Fetching on Click (Lazy Loading)**

> * When the user taps a story card or clicks **"Continue"**, the app sends an asynchronous fetch() request specifically for that story file (e.g., /stories/story-042.enc).  
> * A 5,000-word story is roughly 30 KB. It downloads in under a tenth of a second, decrypts in memory in roughly 2 milliseconds, and immediately displays.

#### **3\. Smart Local Caching (Offline Reading)**

> * Once a story is downloaded and decrypted, it is cached directly on the device using the browser's **Cache API** or **IndexedDB**.  
> * If the user closes the app, goes offline, or reopens the story later, the app serves it instantly from local device storage without reaching out to GitHub Pages again.  
> * Unopened stories remain on the server and take up zero device storage.

### **Performance Comparison**

&nbsp;

| Metric | Monolithic Bundle (100 Stories) | Split On-Demand Architecture |
| :---- | :---- | :---- |
| **Initial Download** | \~3–5 MB | **\~25–40 KB** |
| **First Contentful Paint** | 2.5s – 5.0s on mobile | **\< 0.4s** |
| **Memory Consumption** | High (decrypting megabytes of text) | **Near zero** (only active story in RAM) |
| **Data Usage** | Heavy (downloads all stories upfront) | **Pay-as-you-read** (only downloaded when tapped) |

This keeps everything inside your single GitHub repository, maintains your encryption privacy, and guarantees instant loading regardless of how large your library grows.

---

*User prompt: How you can make the decryted stories cann't be readable and hackable from the browser, it should be only read through the browser UI.*

Response: In web architecture, there is an inescapable rule known as the **Client-Side Dilemma**:

If the client’s device possesses the decryption key and needs to render the text for human eyes, the decrypted data **must exist in the device's memory**. Therefore, absolute 100% protection against a technically skilled user with Developer Tools is mathematically impossible on an open browser.

If someone opens DevTools, inspects browser memory, or uses an OCR screen-grabber, they can capture the text. Netflix and major publishers spend millions on hardware-level DRM (Widevine/FairPlay) to fight this, and even that gets bypassed.

However, you **can** make it extraordinarily difficult for 99% of users to extract, copy, or scrape your stories. Here is the defense-in-depth architecture to lock down the stories inside the UI as tightly as the web platform allows.

### **1\. Ephemeral, Chunk-Only Decryption (No Stored Plaintext)**

The biggest mistake in client-side apps is decrypting the entire book and storing the plaintext in localStorage, sessionStorage, or a global JavaScript variable.

> * **Decrypt only the active screen:** When a user opens page 4, the app decrypts *only* paragraph 4\.  
> * **Garbage collect immediately:** As soon as the page turns, the previous text variable is set to null and overwritten in memory.  
> * **Keep storage encrypted:** Never store the decrypted story in IndexedDB or Cache API. Cache only the encrypted .enc binary blobs.

// Decrypt strictly on-demand, render, then dereference  
async function renderPage(encryptedChunk, key) {  
&nbsp;&nbsp;let plaintext \= await decryptAES(encryptedChunk, key);  
&nbsp;&nbsp;displayElement.textContent \= plaintext;  
&nbsp;&nbsp;  
&nbsp;&nbsp;// Wipe reference from scope immediately  
&nbsp;&nbsp;plaintext \= null;  
}

### **2\. Render Text via HTML5 Canvas (Hides Text from the DOM)**

If you render text using standard HTML tags (\<p\> or \<div\>), anyone can right-click, press **Inspect Element**, and copy the text straight from the Elements tab.

> * **The Canvas Approach:** Instead of inserting HTML text, render the text onto an HTML5 \<canvas\> element using the 2D drawing context (ctx.fillText()).  
> * **Why this works:** To the browser DOM, the entire story is just a grid of graphical pixels, not searchable or selectable text. There are no DOM nodes containing your story words.  
> * **Trade-off to consider:** Because canvas renders raw pixels, built-in browser text selection, accessibility screen readers, and native pinch-to-zoom require custom handling. For older readers, you must implement explicit on-screen font-size buttons (+ / \-) that redraw the canvas at higher resolutions.

### **3\. Decrypt Inside a WebAssembly (Wasm) Module**

If decryption is written in plain JavaScript, any user can open the Sources tab in DevTools, set a breakpoint on your decrypt() function, and read the return value.

> * Compile your decryption logic (e.g., in Rust, C, or Go) into a compiled **WebAssembly (.wasm) binary**.  
> * The decryption routine runs in compiled byte code rather than readable JS source code.  
> * The Wasm memory heap is separate and much more tedious to reverse-engineer than stepping through a standard JS script.

### **4\. UI Hardening (Preventing Casual Copying)**

You can disable standard browser copy mechanisms across the reading container:

> * **Disable text selection and touch callouts:**  
>   .reader-container {  
>   &nbsp;&nbsp;\-webkit-user-select: none; /\* Safari \*/  
>   &nbsp;&nbsp;\-ms-user-select: none;     /\* IE 10+ \*/  
>   &nbsp;&nbsp;user-select: none;         /\* Standard \*/  
>   &nbsp;&nbsp;\-webkit-touch-callout: none; /\* iOS long-press menu \*/  
>   }

> * **Block context menu and copy shortcuts:**  
>   // Block right-click context menu  
>   document.addEventListener('contextmenu', (e) \=\> e.preventDefault());

>   // Block Ctrl+C / Cmd+C, Ctrl+P (Print), Ctrl+S (Save)  
>   document.addEventListener('keydown', (e) \=\> {  
>   &nbsp;&nbsp;if ((e.ctrlKey || e.metaKey) && \['c', 'p', 's', 'u'\].includes(e.key.toLowerCase())) {  
>   &nbsp;&nbsp;&nbsp;&nbsp;e.preventDefault();  
>   &nbsp;&nbsp;}  
>   });

> * **Disable printing via CSS:**  
>   @media print {  
>   &nbsp;&nbsp;body {  
>   &nbsp;&nbsp;&nbsp;&nbsp;display: none \!important;  
>   &nbsp;&nbsp;}  
>   }

### **5\. In-Memory Key Derivation (Never Save the Master Key)**

If you save the actual decryption key in localStorage, anyone inspecting storage has the master key.

> 1. Prompt the user for a **Passphrase**.  
> 2. Run it through **PBKDF2** or **Argon2** in memory to derive the AES decryption key.  
> 3. Keep that key in a private closure or Web Worker memory only.  
> 4. If the user refreshes or closes the tab, the key evaporates from memory. (Optionally, use sessionStorage with a time-based auto-wipe if you want them to navigate between tabs without re-entering the passphrase every time).

### **Summary of Protection Levels**

&nbsp;

| Attack Vector | Standard HTML/JS | Hardened Pipeline (Canvas \+ Ephemeral Wasm) |
| :---- | :---- | :---- |
| **Right-click \-\> Copy** | Trivial | **Blocked** |
| **Inspect Element (DOM)** | Visible as plaintext | **Invisible** (Only raw canvas pixels) |
| **Network Sniffing** | Encrypted blobs (.enc) | Encrypted blobs (.enc) |
| **Browser Storage Scraping** | Plaintext if cached | **Encrypted only** |
| **DevTools Debugger Breakpoint** | Trivial in JS file | **Difficult** (Hidden inside compiled Wasm) |
| **Analog Hole (Screenshot / OCR)** | Possible | Possible (Cannot be prevented on any web app) |

For your audience of older readers, **chunked ephemeral decryption \+ UI selection blocking** gives you the best balance: it stops copying and automated scraping while still allowing large, sharp, accessible vector typography without the visual artifacts of canvas rendering.

---

*User prompt: UX should be also be though correctly. 1\. Users will be using in the phones and tablets. 2\. Swiping or scrolling the stories instead of hard buttons. 3\. And jump to chapters \--\> by detecting main headlines from the md format. Above are the few suggestions, and this workflow has to be done thoughtfully.*

Response: Designing for touch devices and older readers means shifting the paradigm from a traditional "website" to a native-feeling e-reader (like a Kindle or Apple Books).

Since we are combining **high security (ephemeral memory)** with **smooth UX (swiping and chapters)**, the architecture needs a clever approach so the app doesn't have to decrypt the entire book just to find chapter titles.

Here is the thoughtful UX and technical workflow to make this seamless:

### **1\. The "Pre-Computed" Chapter Navigation**

You cannot scan an encrypted file for Markdown headings (\#\# Chapter 1\) on the fly without decrypting the whole thing—which violates our memory-security rule.

**The Solution:** The heavy lifting happens on your computer *before* you upload.

> * **The Build Script:** When your local Node.js script processes the Markdown, it scans for \# or \#\# tags.  
> * **The Metadata Map:** It creates a lightweight, separate map (e.g., Chapter 1 starts at Chunk 12).  
> * **The UI Experience:** When the user opens a story, the app downloads this tiny metadata file. A hamburger menu (or a simple "Chapters" icon) slides open a drawer. When they tap "Chapter 3", the app instantly fetches, decrypts, and renders just the chunks starting at that index.

### **2\. The "Three-Page" Swipe Carousel (Memory Virtualization)**

To support smooth horizontal swiping without loading the whole story into the browser's DOM (which slows down old phones and exposes plaintext), we use a **Virtual Carousel**.

> * **The DOM Structure:** The screen only ever contains exactly three HTML containers: \[Previous Page\], \[Current Page\], \[Next Page\].  
> * **The Swipe (CSS Scroll Snap):** Using native CSS scroll-snap, the user can fluidly swipe their finger left or right. It feels exactly like native iOS/Android paginated swiping.  
> * **The Background Shift:** The moment the swipe finishes and the \[Next Page\] becomes the center view, JavaScript quietly updates the array. It drops the old \[Previous Page\] from memory, shifts everything left, and decrypts the *new* \[Next Page\] invisibly in the background.  
> * **Fallback for Accessibility:** While swiping is primary, always include invisible (or very subtle) tap zones on the far left and right edges of the screen (about 20% of the screen width). Many older users prefer tapping the edge to turn pages rather than executing a swipe gesture.

### **3\. The "Distraction-Free" Reading Zone**

Older readers and phone users need maximum screen real estate for large text.

> * **Hide the UI:** When actively reading, the screen shows nothing but text and the background color. No navigation bars, no chapter menus, no battery indicators if we can help it.  
> * **The Center Tap:** Tapping the center 60% of the screen toggles the UI overlay. This brings up:  
  * **Top Bar:** Back to Library, Chapter/ToC button, and a Theme/Font-size toggle.  
  * **Bottom Bar:** A visual progress bar or slider showing how far along they are in the story.

### **4\. Step-by-Step Technical Workflow**

> 1. **You write:** story.md (including \#\# Chapters).  
> 2. **You build:** The script splits the text into chunks, builds the Table of Contents map, encrypts everything into individual .enc files, and pushes to GitHub Pages.  
> 3. **User opens app:** They enter the passphrase. localStorage remembers it.  
> 4. **User selects story:** The app downloads the ToC map and the first three encrypted chunks.  
> 5. **App renders:** It decrypts the first chunk into the center container and the second chunk into the right-side (Next) container.  
> 6. **User swipes:** The CSS snaps to the next container. The app instantly wipes the old text from memory, updates localStorage with their new progress, and decrypts the upcoming chunk.

---

*User prompt: When user uses back button on a story, it should not close the website, it should go to the library. Like this small things has to be taken care.*

Response: Handling the hardware back button and system gestures is what separates a native-feeling app from a clunky webpage. In a Single Page Application (SPA), if you don't explicitly manage the browser's history, hitting "back" will exit the app completely.

Here is the exact routing and UX logic to handle the back button and other critical "small things" required for a seamless mobile experience.

### **1\. History API (Solving the Back Button Trap)**

To make the back button return to the library instead of closing the app, we must manipulate the browser's History API.

> * **The Rule of Pushing State:** When the user taps a story from the library, the app executes window.history.pushState({ view: 'reader' }, '', '\#reading'). This creates a fake "forward" step in the browser's memory without reloading the page.  
> * **The Rule of Page Turns:** Swiping between pages inside a story **must not** push new history states. If you pushed a state for every page turn, a user on page 50 would have to press the back button 50 times to reach the library. Page turns only update localStorage and the DOM.  
> * **Intercepting the Back Button:** The app listens for the popstate event. When the user uses the hardware back button or swipe-to-go-back system gesture, the app intercepts it, unloads the story from memory, and slides the Library view back onto the screen.

### **2\. Screen Wake Lock (Preventing Sleep)**

Older readers may take longer to read a single page. There is nothing more frustrating than the screen dimming and turning off in the middle of a paragraph.

> * **Implementation:** The app will use the **Screen Wake Lock API**. When the reader view is active, the app requests a lock (navigator.wakeLock.request('screen')).  
> * **Lifecycle Handling:** If the user switches to another app and comes back, the lock is automatically re-requested based on page visibility.

### **3\. Preventing Gesture Conflicts (Double-Tap & Overscroll)**

Mobile browsers have built-in behaviors that will break an e-reader UI if not explicitly disabled.

> * **Disabling Pinch/Double-Tap Zoom:** Because we provide explicit "A+" and "A-" buttons for text sizing in the menu, we must lock the native viewport zoom. Otherwise, a slight double-tap will zoom the UI chaotically.  
>   \<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"\>

> * **CSS touch-action:** To ensure the app captures left/right swipes for page turning seamlessly, we disable the browser's default "swipe-to-navigate-history" gesture using touch-action: pan-y; on the reading container.  
> * **Overscroll Bounce:** We apply overscroll-behavior: none; to the body to prevent the rubber-band bounce effect when reaching the top or bottom of the library, maintaining a rigid, app-like feel.

### **4\. Dynamic Safe Zones (Notches and Home Bars)**

Modern phones have camera notches at the top and gesture bars at the bottom. The app will use CSS environment variables to inject padding automatically, ensuring text is never obscured.

.reader-container {  
&nbsp;&nbsp;padding-top: env(safe-area-inset-top);  
&nbsp;&nbsp;padding-bottom: calc(env(safe-area-inset-bottom) \+ 20px);  
}

### **5\. OS-Level Theme Sync**

While the app will have its own light/dark toggle for the sepia/brown themes, it will initially respect the user's system preferences using the prefers-color-scheme media query. If their phone enters dark mode at sunset, the app will automatically launch in dark mode.

---

