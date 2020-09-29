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
    const manifestFileName = 'output.m3u8';
    const manifestFileUri = `${tempDirUri}/${manifestFileName}`;
    const inputFileUri = `${tempDirUri}/${object.get('input').name()}`;

    await fs.ensureDir(tempDirUri);
    const response = await fetch(object.get('input').url());
    
    let buffer;

    await Promise.all([
      fs.ensureDir(tempDirUri),
      fetch(object.get('input').url())
        .then(response => response.buffer())
        .then(_buffer => buffer = _buffer)
    ]);

    await fs.outputFile(inputFileUri, buffer);

    ffmpeg(inputFileUri)
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
        try {
          log.info(`Converting finished for video ${object.id} !`);

          const fileNames = await fs.readdir(tempDirUri);
          const fileNamesMap = {};
          await Promise.all(fileNames.map(async fileName => {
            if (![manifestFileName, object.get('input').name()].includes(fileName)) {
              const fileBuffer = await fs.readFile(`${tempDirUri}/${fileName}`);
              const file = new Parse.File(fileName, [...fileBuffer]);
              await file.save();
              fileNamesMap[fileName] = file.name();
              let hlsChunks = object.get('hlsChunks');
              if (!hlsChunks) {
                hlsChunks = [];
              }
              hlsChunks.push(file);
              object.set('hlsChunks', hlsChunks);
            }
          }));

          let manifestFileText = await fs.readFile(manifestFileUri, 'utf-8');
          Object.keys(fileNamesMap).forEach(fileName => {
            manifestFileText = manifestFileText.replace(fileName, fileNamesMap[fileName]);
          });

          const hlsManifest = new Parse.File(manifestFileName, [...Buffer.from(manifestFileText)]);
          await hlsManifest.save();

          object.set('hlsManifest', hlsManifest);
          object.set('isReady', true);
          await object.save(null, { useMasterKey: true });

          log.info(`Converted file saved for video ${object.id} !`);
        } catch (e) {
          log.error(e.message);
          throw e;
        } finally {
          fs.remove(tempDirUri);
        }
      }).run();
  })().catch(error => {
    log.error(error.message);
    throw error;
  });
});
