# Dev Toolbox - User Guide

## 📖 Introduction

Multi-purpose Chrome Extension for developers with various utility tools.

**Version:** 0.0.5  
**Author:** © Doan Duy Nhat

---

## 🎯 Feature List

| # | Feature | Description |
|---|---------|-------------|
| 1 | 🔒 Block Close Tab | Prevent accidental tab closing during debug |
| 2 | 📋 Copy Mode | Copy text on any page, even blocked ones |
| 3 | 🌐 Translate Mode | Translate text with Google Translate |
| 4 | ➕ Web Crosshair | Ruler for UI alignment |
| 5 | 📊 Zabbix Charts | Download charts from Zabbix as images/PDF |
| 6 | 📜 Script Loader | Auto-inject scripts into pages |
| 7 | 🚀 API Tester | Test APIs like Postman |
| 8 | 📡 Record Requests | Record HTTP requests |
| 9 | 🔄 Auto Update | Check and update extension |

---

## 1️⃣ Block Close Tab

### Purpose
Prevent browser from closing tab while debugging to avoid data loss.

### How to Use
1. Open extension popup (click icon in toolbar)
2. Enable **"Block Close Tab"** toggle
3. When enabled:
   - Yellow button **"Open DevTools (F12)"** appears on right side
   - You can drag this button elsewhere
4. When closing tab → Browser will ask for confirmation

### Tips
- ⚠️ Recommended to open DevTools (F12) to monitor requests in Network tab
- Yellow button position is auto-saved

---

## 2️⃣ Copy Mode

### Purpose
Allow copying text on pages that block right-click or text selection.

### How to Use
1. Open extension popup
2. Enable **"📋 Copy Mode"** toggle
3. Hover over any text/button → Element gets highlighted
4. Click → Text is copied to clipboard

### Options

| Icon | Option | Description |
|------|--------|-------------|
| 👁️ | Show indicator | Toggle "COPY" badge on page |

### Special Feature for SELECT (dropdown)

When clicking on a `<select>` element, a **selection menu** appears:

| Option | Description | Example |
|--------|-------------|---------|
| 📝 **Value** | Copy the value attribute | `99`, `0`, `1` |
| 📄 **Text** | Copy display text | `すべての伝票`, `交通費精算` |

### Practical Example
```
HTML: <option value="99">すべての伝票</option>

Click on select → Menu appears:
┌─────────────────────────┐
│ 📋 Choose copy type:    │
├─────────────────────────┤
│ 📝 Value    "99"        │
│ 📄 Text     "すべての伝票" │
└─────────────────────────┘
```

---

## 3️⃣ Translate Mode

### Purpose
Translate text to another language directly on the page.

### How to Use
1. Open extension popup
2. Enable **"🌐 Translate Mode"** toggle
3. Select target language from dropdown (English, Vietnamese)
4. Hover or click on text to translate

### Options

| Icon | Option | Description |
|------|--------|-------------|
| 👁️ | Show indicator | Toggle "TRANSLATE" badge on page |
| 👆 | Auto hover | Auto-translate when hovering over text |

### Translation Modes

| Mode | How to Use |
|------|------------|
| **Hover** (👆 enabled) | Move mouse over text → Translation appears automatically |
| **Click** (👆 disabled) | Click on text → Translation appears |

### Special Feature for SELECT (dropdown)
- Automatically extracts the **display text** of selected option for translation
- Example: `<option value="99">すべての伝票</option>` → Translates "すべての伝票" (not "99")

### Supported Languages
- Japanese ↔ Vietnamese
- English ↔ Vietnamese
- And other languages supported by Google Translate

### Note
- 📖 ~250+ common words available offline
- 🌐 Other words use Google Translate (requires internet)

---

## 4️⃣ Web Crosshair (Screen Ruler)

### Purpose
Display horizontal/vertical lines following cursor for UI alignment.

### How to Use
1. Open extension popup
2. Enable **"➕ Web Crosshair"** toggle
3. Click on any webpage
4. Lines will follow your cursor

### Options

| Option | Description |
|--------|-------------|
| 👁️ **Show indicator** | Toggle "Crosshair" badge on page |
| **Mode** | Horizontal / Vertical / Both |
| **Color** | Choose line color |

### Shortcuts
- **ESC**: Temporarily hide lines
- **Click indicator**: Quick toggle crosshair

### Use Cases
- Align UI with design
- Check alignment between elements
- Compare pixel distances

---

## 5️⃣ Zabbix Charts Downloader

### Purpose
Download all charts from Zabbix page as images or PDF.

### How to Use
1. Open a Zabbix page with charts
2. Open extension popup
3. View detected chart count
4. Click:
   - **📥 Download images** → Download individual PNG images
   - **📄 Export PDF** → Combine all charts into 1 PDF file

### Note
- Only works on Zabbix pages
- If charts not detected, try reloading the page

---

## 6️⃣ Script Loader

### Purpose
Auto-inject JavaScript scripts into webpages by domain (like Tampermonkey).

### How to Add Scripts

**Method 1: From URL**
1. Paste script URL in input field (supports GitHub raw URL)
2. Click **➕** button

**Method 2: From local file**
1. Click **📁** button
2. Select `.js` file from your computer

**Method 3: Download template**
1. Click **📄** button to download template
2. Edit as needed
3. Add to extension

### Manage Scripts

| Button | Function |
|--------|----------|
| **Toggle ON/OFF** | Enable/disable script |
| **🔄 Update** | Update from source URL |
| **📝 Edit** | Edit script variables |
| **🗑️ Delete** | Remove script |

### Script Configuration (UserScript header)
```javascript
// ==UserScript==
// @name        Script Name
// @version     1.0.0
// @match       https://example.com/*
// @updateURL   https://raw.githubusercontent.com/.../script.js
// @var         apiKey = "your-key"
// @var         debugMode = true
// ==/UserScript==

// Your code here
console.log('Script loaded!', apiKey, debugMode);
```

### Tag Explanation

| Tag | Description | Example |
|-----|-------------|---------|
| `@name` | Display name | `My Script` |
| `@version` | Version number | `1.0.0` |
| `@match` | URL pattern to inject | `https://example.com/*` |
| `@updateURL` | URL to check for updates | GitHub raw URL |
| `@var` | Editable variable from popup | `apiKey = "xxx"` |

### Important Options
- **🖼️ Run in iframe:**
  - ✅ ON: Script runs in iframes too
  - ❌ OFF: Script only runs in main page

### Troubleshooting

**Script not running?**
- ✓ Check `@match` pattern
- ✓ Ensure script is toggled ON
- ✓ Reload page after adding script
- ✓ Open Console (F12) for errors

---

## 7️⃣ API Tester

### Purpose
Test API requests directly in browser with full features.

### How to Open

| Button | Description |
|--------|-------------|
| **Open** | Open API Tester in new tab (may get CORS errors) |
| **📌** | Inject API Tester into current page (**BYPASS CORS!**) |

### 📌 Inject Mode (Bypass CORS)

When you encounter CORS errors in regular API Tester:
```
❌ Error: Failed to fetch
Access-Control-Allow-Origin...
```

**Solution: Use the 📌 Inject button!**

1. Open the web page you want to test API on
2. Click the **📌** button (orange) in popup
3. API Tester panel appears on the page
4. Make requests from page context → **No CORS!**

### Inject Mode Features

| Feature | Description |
|---------|-------------|
| **Bypass CORS** | Request from same origin, not blocked |
| **Send Cookies** | Automatically sends page cookies |
| **Draggable** | Drag panel to move around |
| **Minimize** | Collapse panel when not using |
| **Import cURL** | Paste cURL command to import |
| **Relative URL** | Supports relative URLs (e.g., `/api/users`) |

### General Features

| Feature | Description |
|---------|-------------|
| **HTTP Methods** | GET, POST, PUT, PATCH, DELETE |
| **Headers** | Add/edit custom headers |
| **Body** | JSON, form-data, x-www-form-urlencoded, raw |
| **Auth** | Bearer Token, Basic Auth, API Key |
| **Import cURL** | Paste cURL command to import |
| **Import List** | Import JSON file from Record Requests |
| **Load Records** | Load request from recorded list |
| **History** | View request history |

### View Response

| Tab | Description |
|-----|-------------|
| **Body** | Response with syntax highlighting |
| **Headers** | Response headers |
| **Cookies** | Cookies that were set |

### View Modes
- **Pretty**: Formatted JSON/HTML
- **Raw**: Raw data
- **Preview**: Render HTML

### Comparison of 2 Modes

| Criteria | Open (new tab) | 📌 Inject |
|----------|----------------|-----------|
| CORS | ❌ May be blocked | ✅ Fully bypassed |
| Cookies | ❌ Not sent | ✅ Auto-sent |
| Relative URL | ❌ Not supported | ✅ Works |
| History | ✅ Yes | ❌ No (session only) |
| UI | ✅ Full | ⚡ Compact |

---

## 8️⃣ Record Requests

### Purpose
Record HTTP requests to export as cURL or JMeter test script.

### How to Use

**Step 1: Enable Recording**
- Enable **"Record Requests"** toggle

**Step 2: Filter Domain (Optional)**

| Setting | Behavior |
|---------|----------|
| Leave empty | Record ALL requests |
| Enter domain | Only record requests from that domain |
| Click "Get domain" | Auto-fill current tab's domain |

**Step 3: Perform Actions**
- Do anything on the website
- Extension automatically records requests

**Step 4: View List**
- Click **"📋 View"** to display
- Each request has: 📋 Copy cURL | 🚀 Open API Tester | 🗑️ Delete

**Step 5: Export**

| Button | File | Purpose |
|--------|------|--------|
| **Export JMeter** | `.jmx` | Load testing with Apache JMeter |
| **Export cURL** | `.sh` | Replay requests via command line |
| **📋 JSON** | `.json` | Export to import into API Tester |

### Import into API Tester
1. Click **📋 JSON** to export JSON file
2. Open **API Tester**
3. Click **📁 Import List**
4. Select the exported JSON file
5. Click on a request to test → Auto-loads into form

### Options
- 👁️ **Show indicator**: Toggle "REC" badge on page

---

## 9️⃣ Auto Update

### Purpose
Check and download latest updates from GitHub.

### How to Use
1. Scroll to bottom of popup
2. Click **"Check"**
3. If new version available → Follow instructions

### Manual Update
1. Download ZIP file from link
2. Extract over existing extension folder
3. Go to `chrome://extensions`
4. Click **🔄 Reload**

---

## 🌐 Multi-language

Extension supports 3 languages:
- 🇻🇳 Tiếng Việt (Vietnamese)
- 🇬🇧 English
- 🇯🇵 日本語 (Japanese)

**Change language:** Select from dropdown at top of popup

---

## 💡 Tips & Best Practices

### Debug API Combo
```
1. Enable "Record Requests" with API domain
2. Interact with page
3. Click 🚀 → Open request in API Tester
4. Modify params and test again
```

### UI Alignment Combo
```
1. Enable "Web Crosshair"
2. Move mouse to see coordinates
3. Screenshot and compare with design
```

### Load Testing Combo
```
1. Enable "Record Requests"
2. Perform user flow (login → browse → checkout)
3. Export JMeter
4. Open JMeter → Config threads → Run test
```

### Bypass Copy-blocked Pages
```
1. Enable "Copy Mode"
2. Click on text you want to copy
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not working | Reload extension in `chrome://extensions` |
| Script not injecting | Check `@match`, toggle ON, reload page |
| API Tester CORS error | Use proxy or test from backend |
| Not seeing requests | Check toggle ON, domain filter is correct |

---

## 📞 Support

1. Check Troubleshooting section
2. Open Console (F12) for errors
3. Reload extension and try again
4. Contact author

---

## 👨‍💻 Author

**© Doan Duy Nhat**

GitHub: [rakusvn-ddnhat/keep-alive-extension](https://github.com/rakusvn-ddnhat/keep-alive-extension)
