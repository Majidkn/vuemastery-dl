// 1. Open the browser developper console on the network tab
// 2. Start the video
// 3. In the dev tab, locate the load of the "master.json" file, copy its full URL
// 4. Run: node vimeo-downloader.js "<URL>"
// 5. Combine the m4v and m4a files with mkvmerge

const fs = require('fs');
const url = require('url');
const https = require('https');
// const { exec } = require("child_process");

startDownloadByID(258707456,122963)

async function startDownloadByID(vID,appID) {
  try {
  var masterUrl = await getVimeoPageByID(vID,appID)
  }catch(e){
    console.log('Error On video:' + vID);
    console.error(e);
    return;
  }
  
  if(masterUrl.length === 0){
    console.log('Error On video:' + vID);
    console.log('Cannot get Master url!');
    return;
  }
  console.log(`Start Proccess on:` + masterUrl);
  getJson(masterUrl, (err, json) => {
    if (err) {
     throw err;
    }
    
    const videoData = json.video.pop();
    const audioData = json.audio.pop();
    
    const videoBaseUrl = url.resolve(url.resolve(masterUrl, json.base_url), videoData.base_url);
    const audioBaseUrl = url.resolve(url.resolve(masterUrl, json.base_url), audioData.base_url);
    
    processFile('video', videoBaseUrl, videoData.init_segment, videoData.segments, json.clip_id + '.m4v', (err) => {
      if (err) {
        throw err;
      }
      
      processFile('audio', audioBaseUrl, audioData.init_segment, audioData.segments, json.clip_id + '.m4a', (err) => {
        if (err) {
          throw err;
        }
      });
      // Merge movies
      // exec('ffmpeg -i '+json.clip_id+'.m4v -i '+json.clip_id+'.m4a -acodec copy -vcodec copy '+json.clip_id+'.mp4');
    });
  });
  
}

async function getVimeoPageByID(id,appID){
  return new Promise(function(resolve, reject) {
    https.get('https://player.vimeo.com/video/'+id+'?autoplay=1&app_id='+appID, res => {
      res.setEncoding("utf8");
      let body = "";
      res.on("data", data => {
        body += data;
      });
      res.on("end", () => {
        resolve(findJsonUrl(body));
      });
      res.on('error', (e) => {
        reject(e)
      });
    });
  })
}

// parse main js
function findJsonUrl(str){
  const regex = /skyfire.vimeocdn(.*?)base64_init=1/gm;
  let res = regex.exec(str);
  if(res !== null){
    if(typeof res[2] !== "undefined"){
      return 'https://' + res[2];
    }
    if(typeof res[0] !== "undefined"){
      return 'https://' + res[0];
    }
  }
  return '';
}

function processFile(type, baseUrl, initData, segments, filename, cb) {
  if (fs.existsSync(filename)) {
    console.log(`${type} already exists`);
    return cb();
  }
  
  const segmentsUrl = segments.map((seg) => baseUrl + seg.url);
  
  const initBuffer = Buffer.from(initData, 'base64');
  fs.writeFileSync(filename, initBuffer);
  
  const output = fs.createWriteStream(filename, {flags: 'a'});
  
  combineSegments(type, 0, segmentsUrl, output, (err) => {
    if (err) {
      return cb(err);
    }
    
    output.end();
    cb();
  });
}

function combineSegments(type, i, segmentsUrl, output, cb) {
  if (i >= segmentsUrl.length) {
    console.log(`${type} done`);
    return cb();
  }
  
  console.log(`Download ${type} segment ${i}`);
  
  https.get(segmentsUrl[i], (res) => {
    res.on('data', (d) => output.write(d));
    
    res.on('end', () => combineSegments(type, i+1, segmentsUrl, output, cb));
    
  }).on('error', (e) => {
    cb(e);
  });
}

function getJson(url, cb) {
  let data = '';
  
  https.get(url, (res) => {
    res.on('data', (d) => data+= d);
    
    res.on('end', () => cb(null, JSON.parse(data)));

  }).on('error', (e) => {
    cb(e);
  });
}