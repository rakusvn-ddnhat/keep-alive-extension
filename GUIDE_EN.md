# Tab Keeper & Request Recorder

Chrome Extension for blocking tab closure and recording HTTP requests for debugging and testing.

---

## 🎯 2 Main Features

### 1️⃣ Block Close Tab

**Purpose:** Prevent browser from closing tab while debugging, avoid data loss.

**How to use:**
1. Open extension popup (click icon in toolbar)
2. Enable **"Block Close Tab"** toggle (first toggle)
3. When enabled:
   - A yellow button **"Open DevTools (F12)"** appears on the right side
   - You can drag this button elsewhere if it blocks UI
4. When you try to close the tab, browser will ask for confirmation

**Note:**
- ⚠️ Recommended to open DevTools (F12) to monitor requests in Network tab
- Yellow button is draggable and position is auto-saved

---

### 2️⃣ Record Requests

**Purpose:** Record HTTP requests to export as cURL or JMeter test script.

**How to use:**

#### Step 1: Enable Recording
1. Open extension popup
2. Enable **"Record Requests"** toggle (second toggle)

#### Step 2: Filter Domain (Optional)
- **Leave empty** → Record ALL requests
- **Enter specific domain** (e.g., `example.com`) → Only record requests from that domain
- **"Get Domain" button** → Auto-fill domain from current tab

#### Step 3: Perform actions
- Do anything on the website (click, submit form, API calls...)
- Extension will automatically record all requests

#### Step 4: Check request count
- Number of recorded requests displays in the middle of popup
- E.g., `15 requests recorded`

#### Step 5: Export
**A. Export JMeter** (Test automation)
1. Click **"Export JMeter"** button (first blue button)
2. `.jmx` file will automatically download
3. Open this file with Apache JMeter to run load tests

**B. Export cURL** (Command line)
1. Click **"Export cURL"** button (second green button)
2. `.sh` file will automatically download
3. Run this file in terminal to replay requests

#### Step 6: Clear data
- Click **"Clear All"** button (red button) to delete all recorded requests

---

## 🌐 Multi-language Support

Extension supports 3 languages:
- 🇻🇳 Tiếng Việt (Vietnamese)
- 🇬🇧 English
- 🇯🇵 日本語 (Japanese)

**Change language:**
1. Open extension popup
2. Select language from dropdown at the top
3. All text will automatically change

---

## 💡 Tips & Best Practices

### When to use "Block Close Tab"?
✅ Debugging and afraid of accidentally closing tab
✅ Filling long form, want to ensure no data loss
✅ Testing complex flow that needs to maintain state

### When to use "Record Requests"?
✅ Want to replay API calls
✅ Create test automation script for JMeter
✅ Debug network issues
✅ Learn how a website calls APIs

### When to filter domain?
- **No filter (empty):** When you want to record ALL requests  
- **With filter:** When you only care about requests from 1 specific domain 

---

## 📋 Real-world Examples

### Example 1: Debug form submission
```
1. Enable "Block Close Tab" → Ensure no accidental tab closing
2. Enable "Record Requests" 
3. Enter domain: "api.example.com"
4. Fill form and submit
5. Export JMeter → Get automated test case
```

### Example 2: Learn how website works
```
1. Enable "Record Requests"
2. Leave domain empty → Record everything
3. Interact with website
4. Export cURL → See all API calls
```

### Example 3: Load testing
```
1. Enable "Record Requests"
2. Enter backend domain
3. Perform user flow (login → browse → checkout)
4. Export JMeter
5. Open JMeter → Config number of users → Run load test
```

---

## 🔧 Troubleshooting

**Q: Not seeing recorded requests?**
- ✓ Check if "Record Requests" toggle is enabled
- ✓ Check if domain filter is correct
- ✓ Open DevTools (F12) Network tab to confirm there are requests

**Q: "Get Domain" button not working?**
- ✓ Make sure you're on a tab with valid URL (not `chrome://` or `about:blank`)

**Q: Export file is empty?**
- ✓ No requests have been recorded yet
- ✓ Enable recording before interacting with website

**Q: Yellow button blocking UI?**
- ✓ Drag it elsewhere, position will be saved

---

## 👨‍💻 Author

© Doan Duy Nhat

---

## 📞 Support

If you have issues or questions:
1. Check Troubleshooting section above
2. Open DevTools Console to see if there are errors
3. Reload extension and try again

---

## 🎉 Success!

Extension is now ready. Happy debugging and testing! 🚀
