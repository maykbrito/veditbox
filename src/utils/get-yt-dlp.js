const fs = require('fs')
const { execSync } = require('child_process')
const YTDlpWrap = require('yt-dlp-wrap').default;
const DownloadDirectory = require('./create-download-directory')

// Use Homebrew yt-dlp which has its own isolated Python (no env python3 shebang issues)
// o script do brew usa shebang `env python3`; sem isso o Electron acha o python3.9 do Xcode (yt-dlp exige 3.10+)
process.env.PATH = `/opt/homebrew/bin:${process.env.PATH}`

const brewPath = '/opt/homebrew/bin/yt-dlp'
const binaryPath = fs.existsSync(brewPath) ? brewPath : 'yt-dlp'

DownloadDirectory.create()

module.exports = new YTDlpWrap(binaryPath);