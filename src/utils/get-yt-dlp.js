const axios = require('axios')
// const os = require('os')
const fs = require('fs')
const YTDlpWrap = require('yt-dlp-wrap').default;
const DownloadDirectory = require('./create-download-directory')
const { CONSTANTS } = require('./constants');

const filePath = `${CONSTANTS.destDownloadFolder}/yt-dlp`

async function downloadLatestRelease() {
    try {
        if(fs.existsSync(filePath)) return

        console.log('downloading yt-dlp')
        //Get the data from the github releases API. In this case get page 1 with a maximum of 5 items.
        let githubReleasesData = await YTDlpWrap.getGithubReleases(1, 5);

        // const platform = os.platform();
        const assets = githubReleasesData[0].assets
        // let releases = assets.filter(asset => asset.name.includes(platform));
        let release = assets.find(asset => asset.name === "yt-dlp");
  
        // if (releases.length === 0) {
        //     throw new Error(`No release assets found for platform: ${platform}`);
        // }

        if(!release) throw new Error('No release found')
  
        const downloadUrl = release.browser_download_url;
        const downloadResponse = await axios.get(downloadUrl, { responseType: 'stream' });
  
        const fileWriter = fs.createWriteStream(filePath);
        downloadResponse.data.pipe(fileWriter);
  
        return new Promise((resolve, reject) => {
            fileWriter.on('finish', resolve);
            fileWriter.on('error', reject);
        });
    } catch (error) {
        console.error('Error occurred while downloading release:', error);
    }
}


(async() => {
    DownloadDirectory.create()

    await downloadLatestRelease()
    //Download the yt-dlp binary for the given version and platform to the provided path.
    //By default the latest version will be downloaded to "./yt-dlp" and platform = os.platform().
    await YTDlpWrap.downloadFromGithub(filePath);

})()

module.exports = new YTDlpWrap(filePath);