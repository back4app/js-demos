const fs = require('fs-extra');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

Parse.Cloud.afterSave('Video', ({ original, object, log }) => {  
  if (original || !object || !object.get('input')) {
    return;
  }

  (async () => {
    const tempDirUri = `/temp/${object.id}`;
    const manifestFileUri = `${tempDirUri}/output.m3u8`;

    let body;
    log.info(object.get('input').url());

    await Promise.all([
      fs.ensureDir(tempDirUri),
      fetch(object.get('input').url()).then(response => {
        log.info(response.status);
        body = response.body;
      })
    ]);

    ffmpeg(body)
      .outputOptions([
        '-profile:v baseline',
        '-level 3.0',
        '-start_number 0',
        '-hls_time 5',
        '-hls_list_size 0',
        '-f hls'
      ])
      .output(manifestFileUri)
      .on('error', err => {
        log.error(`An error occurred converting video ${object.id} : ${err.message}`);
      })
      .on('end', async () => {
        log.info(`Converting finished for video ${object.id} !`);

        // fs.remove(tempDirUri);
      }).run();
  })();
});
