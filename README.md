# -Browser-Server-Monitor
Powerful extension for monitoring servers and viewing logs.

🚀 Browser Server Monitor — Features
📡 Server Monitoring
Multi-server support — monitor unlimited servers in one panel
Real-time ping monitoring — HTTP and TCP (IP:PORT) ping types
Customizable ping intervals — from 5 seconds to 1 hour per server
Danger threshold — yellow warning when ping exceeds custom ms value
Ping history graph — visual 30-point bar chart with auto-scaling
Status indicators — green (online), yellow (danger), red (offline/timeout)
Server avatars — custom images or auto-generated initials
Drag & drop reordering — rearrange servers in sidebar
📜 Log Viewer
Real-time log streaming — auto-refresh with per-log intervals (1-300s)
Multiple logs per server — chat, console, error, kill logs, etc.
Log level detection — automatic ERROR/WARN/INFO highlighting
Chat message parsing — structured display with timestamps, channels, players
Search & filter — real-time search with regex support
Level filters — quick buttons for ERR/WRN/INF
Word wrap toggle — switch between wrapped and horizontal scroll
Download logs — export visible lines to .log file
Smart auto-scroll — pauses when user scrolls up, shows "new messages" indicator
Caching — last 50 lines cached per log for instant display
🎨 Theme & Customization
12 built-in presets — Classic Dark, Matrix, Blood Moon, Ice Blue, Sunset, Forest, Midnight, Cyberpunk, Amber CRT, Minimal, High Contrast, Royal Gold
Custom presets — save your own themes
Live preview — see changes instantly while editing
Color customization:
Panel background + opacity
Text color
Error/Warning/Hover backgrounds
Font customization:
9 monospace fonts (SF Mono, JetBrains Mono, Fira Code, Cascadia, etc.)
Font size (9-16px)
Line height (1-2)
Letter spacing
Bold toggle
Border customization:
Width (0-6px)
Corner radius (0-12px)
Style (solid/dashed/dotted/none)
🚨 Alert System
Offline alerts — sound + notification + flash when server goes down
Trigger alerts — fire on specific words in logs
Per-alert configuration — custom sound, notification, flash for each trigger
Alert acknowledgment — confirm individual alerts or all at once
Alert history — view last 50 alerts per server
Badge counter — shows unacknowledged alerts count
Cooldown protection — 30s between same trigger alerts
Duplicate prevention — confirmed lines don't re-trigger
Custom sounds — upload your own audio files (up to 500KB)
Mute toggle — silence all sounds with one click
✨ Triggers & Highlights
Custom word highlighting — any word with custom colors
Background highlighting — semi-transparent background behind triggers
Bold toggle — make triggers bold
Case-insensitive matching — finds words regardless of case
Multiple triggers — unlimited words highlighted simultaneously
Import from file — bulk import triggers from .txt file
Color picker — visual color selection for text and background
✂️ Filters
9 filter types:
hide_date — remove timestamps
hide_tag_message — remove [MESSAGE] tags
hide_exact — hide lines containing text
hide_regex — regex-based filtering
trim_start / trim_end — cut characters from start/end
trim_before_text / trim_after_text — cut around text
trim_exact_text — remove exact text
Scope selection — apply to all/chat/console only
Reorderable — drag filters up/down
Context menu creation — right-click log line to create filter
🚫 Blacklist
Two modes:
hide_line — completely hide lines containing word
mask_word — replace word with ***
Case-sensitive option — strict matching
Import from file — bulk import from .txt
Unlimited entries — no limit on blacklisted words
🤖 AI Analysis
Multi-provider support — OpenAI and Anthropic (Claude)
Error explanation — analyze ERROR lines with context
Context-aware — sends 3 lines before/after for better analysis
Markdown rendering — formatted output with code blocks
Copy to clipboard — one-click copy of AI response
Secure API keys — stored in encrypted sync storage
Model selection — choose GPT-4o-mini, GPT-4o, Claude 3.5 Sonnet, etc.
⭐ Favorites
Star any log line — save important entries
Per-server, per-log storage — organized by source
Quick access panel — view all favorites in one place
Persistent storage — survives browser restarts
📊 Statistics
Real-time counters — errors and warnings today
Average response time — calculated from ping history
Uptime percentage — based on online/offline history
Top errors — most frequent exception types
Live updates — refreshes with each log update
🎮 Server Commands (Universal)
HTTP adapter — send commands via PHP/Node.js proxy
Universal interface — works with any game server
Built-in commands:
Status check
Server restart
Player kick/ban
Broadcast message
Custom commands
Command logging — all actions logged server-side
API key security — protect adapter with secret key
IP whitelist — restrict access by IP
🔐 Security
Content Security Policy — strict CSP in manifest
API key protection — encrypted storage
IP whitelist — for command adapter
Rate limiting — prevent abuse
XSS protection — all user input escaped
CORS handling — proper cross-origin requests
💾 Data Management
Full backup/restore — export all settings to JSON
Selective export — include/exclude cache and sounds
Import preview — see what will be restored before applying
Chrome Sync — settings sync across devices
Local cache — fast access to recent logs
🌍 Internationalization
5 languages — English, Russian, Ukrainian, German, Spanish
Auto-detection — uses browser language
Manual switch — change in settings
Full translation — all UI elements translated
RTL support — proper text direction
🎯 User Experience
Collapsible sidebar — save screen space
Resizable panels — drag to adjust widths
Tooltips — hover for server names in collapsed mode
Keyboard shortcuts:
/ or Ctrl+K — focus search
Esc — clear search
Alt+Shift+B — open panel
Alt+Shift+M — toggle mute
Toast notifications — non-blocking feedback
Confirm dialogs — prevent accidental deletions
Focus preservation — cursor stays in field during re-renders
Debounced saves — smooth typing without lag
📱 Responsive Design
Mobile-friendly — adapts to small screens
Print styles — clean output when printing
Reduced motion — respects accessibility settings
Dark theme — easy on eyes for long sessions
⚡ Performance
Debounced operations — saves and searches optimized
Batch storage writes — reduces I/O operations
AbortController — cancels stale fetch requests
Efficient DOM updates — only changed lines re-rendered
Chrome Alarms API — reliable background pings (MV3)
Memory management — max 50 lines per log, 50 alerts per server
🔧 Advanced Features
Service Worker persistence — pings work even when panel closed
Multi-tab sync — changes reflect across all instances
Error recovery — graceful fallback on failures
Debug tools — console logging for troubleshooting
Version tracking — backup files include version info
