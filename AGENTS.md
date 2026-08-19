# Goal
A manifest V3 Browser Extension which allows AI agent to observe and act on websites.
this is a general purpose chrome extension, so do not mention anything about specific topic like job application, use general purpose variable names.

## Tech Stack
- reactjs
- typescript
- Tailwind styling library

## folder structure
- the browser extension will be in `E:\dev\eskai.net\packages\browser-use-relay-mcp\extension` directory.
- mcp client server will be on the root of the working directory which is `E:\dev\eskai.net\packages\browser-use-relay-mcp`

## extension permissions
- it must get all the permissions by default in order to avoid mistakes.

## UI
- we use dark theme with black background and light text and elements.
- on user click on extension icon user must see the status and enabled/disabled of the extension via a toggle button.
- a gear button which redirect the user to setting page of the extension.
- a lable which shows the ip and port of the raly, in case of external access enabled we need to show a new lable with  local network ip and port under the local one, there must be a button with copy icon before each so user can copy the ip and ports.

### Settings Page
- a label element which shows local ip of the device.
- a toggle button which say "External Access" and by enabling it the label shows local and local network address of the device so external AI agent from another computer also be able to control it.
- a number input for raly `Port` and we need to have a default port for it so if the user previously did not set a port we look for a free port and set it.
- a refresh icon button which apply the changes user made to port
- we save all the settings for the next runs of the extension.


## Functionality
* this browser extension must be able to do anything on websites.
- it must NOT manipulate the website dom but it is allowed to take a copy of current dom and do manipulation without touching the original dom of the website.
- it must work on website which are built by single page application libraries or freamwork such a as Reactjs or Nextjs and others.
- must be change aware and revalidate the changes. 
- agents must be able to get what they are looking for, for example scrapping cards on the site.
- it must be able to build a nice catalog of elements on page with id for each so AI agent easily be able to send act command such a as clicking typing and all sort of things.
- extension must be able to see and control multiple tabs. it must be able to see the tabs user oppened as well as tabs it oppened by it self and be able to close them as well if the count of the tabs are greater than 1 so it does not accidentally close the browser it self.

**we need to keep the extension be like human as much as possible and sites do not see it as bot because we are not making bot and AI agent will do the jobs as an inteligent being**

1. **Mouse / pointer:** `move(x,y)`, `moveTo(element)`, `hover`, `unhover`, `mouseDown`, `mouseUp`, `leftClick`, `middleClick`, `rightClick`, `doubleClick`, `tripleClick`, `clickAndHold`, `release`, `longPress`, `contextMenu`, `modifierClick`, `dragStart`, `dragMove`, `dragEnd`, `dragAndDrop`, `dragToElement`, `dragToCoordinates`, `dragScrollbar`, `dragSlider`, `selectTextByDragging`.

2. **Wheel / scrolling:** `scrollUp`, `scrollDown`, `scrollLeft`, `scrollRight`, `scrollBy(x,y)`, `scrollTo(x,y)`, `scrollToTop`, `scrollToBottom`, `scrollElement`, `scrollIntoView`, `wheel(deltaX,deltaY)`, smooth/instant scrolling. W3C treats wheel scrolling as its own input source.  

3. **Touch / pen:** `tap`, `doubleTap`, `longTap`, `touchStart`, `touchMove`, `touchEnd`, `touchCancel`, `swipe`, `pinchIn`, `pinchOut`, `multiTouch`, plus pointer pressure, tilt, twist and pen buttons. Pinch, for example, is fundamentally multiple simultaneous pointer sequences. 

4. **Keyboard:** `keyDown`, `keyUp`, `press`, `type`, `typeSlowly`, `holdKey`, `releaseKey`, key-repeat, `Enter`, `Tab`, `Shift+Tab`, `Escape`, `Space`, `Backspace`, `Delete`, arrows, `Home`, `End`, `PageUp`, `PageDown`, function keys, `Ctrl`, `Alt`, `Shift`, `Meta`, arbitrary shortcuts like `Ctrl+A/C/V/Z`, and IME/composition input.  

5. **Text editing:** `focus`, `blur`, `clear`, `setValue`, `appendText`, `replaceText`, `insertText`, `deleteText`, `selectAll`, `selectRange`, `setCaretPosition`, `getSelection`, `contentEditableInsert`, `contentEditableDelete`, `undo`, `redo`.

6. **Form controls:** `check`, `uncheck`, `toggleCheckbox`, `selectRadio`, `selectOption`, `deselectOption`, multi-select, `setRange`, `setNumber`, `increment`, `decrement`, `setDate`, `setTime`, `setDatetime`, `setMonth`, `setWeek`, `setColor`, `submitForm`, `resetForm`, `focusField`, `blurField`. HTML exposes these controls as programmable form elements.  

7. **Files:** `setInputFiles`, multiple-file upload, directory upload where supported, `clearFiles`, `dropFile`, `dropFiles`, provide file bytes/name/MIME type from your Native Messaging host, detect upload completion, download files, choose destination in your native component. Native Messaging is the clean bridge from MV3 to your local agent/filesystem.  

8. **Drag-and-drop:** proper `dragstart`, `dragenter`, `dragover`, `dragleave`, `drop`, `dragend`, `DataTransfer`, text payloads, URL payloads and file payloads. HTML formally defines the `DataTransfer`/file mechanism.  

9. **DOM targeting / inspection:** `querySelector`, `querySelectorAll`, CSS selectors, XPath, text matching, exact text, partial text, label, placeholder, ARIA role/name, coordinates, nth-match, parent/child/sibling traversal, open Shadow DOM traversal, iframe traversal, get bounding box, visibility, enabled/disabled, readonly, checked, selected, value, attributes, properties, classes, computed style and focused element.

10. **DOM manipulation:** `getText`, `getHTML`, `setText`, `setHTML`, `getAttribute`, `setAttribute`, `removeAttribute`, `getProperty`, `setProperty`, `addClass`, `removeClass`, `setStyle`, `createElement`, `appendElement`, `removeElement`, `moveElement`, `cloneElement`, `callMethod`.

11. **JavaScript:** `evaluate`, `evaluateOnElement`, `evaluateInFrame`, return JS values, await Promises, execute in MV3 `ISOLATED` world, execute in page `MAIN` world, inject CSS, remove injected CSS. Chrome currently supports both `ISOLATED` and `MAIN`, plus targeting specific/all frames.  

12. **Events:** dispatch `click`, `dblclick`, `contextmenu`, `mousedown`, `mouseup`, `mousemove`, `mouseenter`, `mouseleave`, `mouseover`, `mouseout`, `pointer*`, `touch*`, `wheel`, `keydown`, `keyup`, `beforeinput`, `input`, `change`, `focus`, `blur`, `submit`, `reset`, `drag*`, `composition*`, `CustomEvent`, and arbitrary application-specific events.

13. **Tabs:** `listTabs`, `getActiveTab`, `newTab`, `closeTab`, `activateTab`, `switchTab`, `navigateTab`, `reloadTab`, `duplicateTab`, `moveTab`, `pinTab`, `unpinTab`, `groupTabs`, `ungroupTabs`, `muteTab`, `unmuteTab`, `zoomIn`, `zoomOut`, `resetZoom`. Chrome's Tabs API directly supports creating, modifying and rearranging tabs.  

14. **Navigation:** `goto`, `back`, `forward`, `reload`, `hardReload` equivalent where feasible, `stopLoading`, wait for URL, wait for navigation, wait for DOM ready, wait for load, detect redirects and monitor frame navigation. `chrome.webNavigation` exposes navigation lifecycle information.  

15. **Windows:** create window, close, focus, resize, reposition, minimize, maximize, restore, fullscreen, enumerate windows, move tabs between windows. Chrome exposes window manipulation separately from tabs.  

16. **Frames:** enumerate frames, identify parent/child frames, execute in one frame, execute in all permitted frames, find element inside iframe, wait for iframe, detect frame navigation and handle `about:`, `data:`, `blob:` frames where extension permissions allow it.  

17. **Waiting / synchronization:** `sleep`, `waitForElement`, `waitForElementRemoved`, `waitVisible`, `waitHidden`, `waitEnabled`, `waitDisabled`, `waitStable`, `waitText`, `waitValue`, `waitAttribute`, `waitURL`, `waitNavigation`, `waitFrame`, `waitDOMMutation`, `waitRequest`, `waitResponse`, `waitDownload`, timeout and automatic retry.

18. **Clipboard:** `copy`, `cut`, `paste`, `readClipboard`, `writeClipboard`, text, HTML and supported binary clipboard types. Clipboard access is permission/security controlled. 

19. **Downloads:** start, detect, inspect filename/URL/state, pause, resume, cancel, remove file, erase download record, open downloaded file and reveal where supported. Chrome has a dedicated downloads API and currently exposes pause/resume programmatically.  

20. **Screenshots / visual state:** visible-tab screenshot, element crop using screenshot + bounding box, viewport screenshot, scrolling/full-page screenshot assembled manually, video/audio tab capture where permitted. `captureVisibleTab()` is directly available to extensions. 

21. **Cookies / session:** list/get/set/delete cookies, including cookies inaccessible to normal page JavaScript when extension permissions permit it; partitioned cookie support should also be handled.  

22. **Web storage:** read/write/delete `localStorage`, `sessionStorage`, IndexedDB, Cache Storage and your extension's own `chrome.storage`; clear site state where appropriate.

23. **Network:** observe requests/responses, detect request completion/failure, inspect URLs/methods/headers where APIs permit, block requests, redirect requests, modify request/response headers through supported MV3 mechanisms, extension-side `fetch`, wait for particular API responses. Chrome exposes `webRequest` and declarative network-control APIs.  

24. **Media:** HTML audio/video `play`, `pause`, `seek`, set volume, mute, playback rate, loop, captions/subtitles where exposed through DOM, picture-in-picture/fullscreen requests where browser activation rules permit them, tab mute/unmute.

25. **Page state:** get URL/title/favicon, viewport dimensions, document dimensions, scroll position, active/focused element, selection, device pixel ratio, language, page visibility, online status and document ready state.

26. **Browser data:** browsing history query/delete, bookmarks create/edit/delete, reading list operations, sessions/restoration and browsing-data cleanup if you choose to give the agent those extension permissions. Chrome exposes these as separate extension APIs.  

27. **Mutation / observation:** MutationObserver, ResizeObserver, IntersectionObserver, page errors, DOM changes, URL changes, history `pushState`/`replaceState`, dynamically inserted iframes, dynamically created controls and application state changes.

28. **Agent-friendly compound actions:** `clickElement`, `fillField`, `chooseOption`, `uploadFile`, `downloadFile`, `dragElement`, `extractTable`, `extractLinks`, `findAndClick`, `findAndFill`, `scrollUntilFound`, `clickUntilGone`, `submitAndWait`, `openAndSwitchToNewTab`, `downloadAndWait`, `uploadAndWait`, `retryAction`.

29. **Native/browser UI fallback:** native file chooser, Save As dialog, print dialog, browser permission prompts, HTTP/native authentication dialogs, certificate dialogs, browser toolbar UI, OS clipboard and filesystem interaction. These are the cases where an MV3 content script is not enough and your **Native Messaging companion** needs to take over.  

30. **Critical distinction in your architecture:** every action should support two implementations where sensible: `DOM_ACTION` such as `element.click()`/value assignment, and `INPUT_ACTION` representing actual keyboard/pointer behavior. Script-created DOM events are `isTrusted=false`, so DOM event simulation is not equivalent to browser-generated user input.  

 build **three engines behind one action API**: `Content Script DOM Engine + MV3 Service Worker Browser Engine + Native Messaging OS Engine`. That gets us much closer to “anything a human or website script can do” than trying to cram the entire universe into `content.js`, which is how software eventually becomes an archaeological site.




