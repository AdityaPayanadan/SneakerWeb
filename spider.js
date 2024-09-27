import * as cheerio from "cheerio";
import axios from "axios";
import { Command } from 'commander';
import fs from "fs";
import path from "path";



//CLI program & setting params
const program = new Command();

program
  .option('-r, --recursive', 'recursively download images', false)
  .option('-l, --depth <number>', 'depth to recursively download', 5)
  .option('-p, --path <path>', 'location to download images', '/Users/42adel-dp-120/Desktop')
  .argument('<url>', 'url to scrape');

program.parse(process.argv);
//

const options = program.opts();

let website = program.args[0];
let depth = options.depth;

const dirpath = options.path;
const pastLinks = [website];
const pastImageUrls = [];
let imgcount = 0;
let recursive = options.recursive;

const links = []
const imageUrls = [];

console.log('Recursive: ' + options.recursive);
console.log('Depth: ' + depth);
console.log('Path: ' + dirpath);


//scraper
const pageHTML = await axios.get(website);

const $ = cheerio.load(pageHTML.data);

function findBase() {
  let websplit = website.split('');
  for (let i = 8; i < website.length; i++) {
    if (websplit[i] == '/') {
      const webbase = website.slice(0, i);
      return stringly(webbase);
    }
  }
}

//take array and turn into single word string
function stringly(arr) {
  let val = arr.toString();
  val = val.replace(/,/g, '');
  return val;
}


let webbase = findBase();
let https = "https:"

async function getImageUrls($) {
  $('img').each((index, element) => {
    let url = $(element).attr('src');
    if (!url.includes('#')) {
      url = url.split('');
        if (url[0] == '/') {
          if (url[1] == '/') {
            url = https.concat(url);
          } else {
            url = webbase.concat(url);
          }
        }
      url = stringly(url);
      if (!pastImageUrls.includes(url)) {
        imageUrls.push(url);
        pastImageUrls.push(url);
      }
    }
  })
}

async function downloadImage(url) {
  try {
    const response = await axios({
        url,
        method: 'GET',
        responseType: "stream"
    });

    const fileName = 'image'+imgcount+'.jpg';
    const filePath = path.join(dirpath, fileName);
    imgcount += 1;

    return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filePath))
            .on('error', reject)
            .once('close', () => resolve(filePath))
    })
  } catch(error) {
    console.log("Error occured when downloading image: " + url);
  }
}

function getLinks() {
    $('a').each(function(index, element) {
      let link = $(element).attr('href');
      if (link && link.trim() !== '' && !link.includes('#')) {
        link = link.split('');
        if (link[0] == '/') {
          link = webbase.concat(link);
        }
        link = stringly(link);
        if (!pastLinks.includes(link)) {
          links.push(link);
          pastLinks.push(link);
        }
      }
    })
}

async function followLinks(depth) {
  let count = 0;
  while (links.length > 0 && count < depth) {
    const link = links.shift();
    await scrape(link);
    count++;
  }
  console.log('Finished Scraping');
}

async function scrape(url) {
  try {
    console.log('Scraping: ' + url);
    const pageHTML = await axios.get(url);
    const $ = cheerio.load(pageHTML.data);
    getLinks();
    await getImageUrls($);
    while (imageUrls.length > 0) {
      const url = imageUrls.shift();
      downloadImage(url);
    }
  } catch (error) {
    if (error.response.status) {
      switch (error.response.status) {
        case (404):
          console.log("404 error at: " + url);
          console.log("Continuing scraping...");
          break
        case (500):
          console.log("Server error error at: " + url);
          console.log("Continuing scraping...");
          break
        case (403):
          console.log(url + " is forbidden");
          console.log("Continuing scraping...");
          break
        default:
        console.log("Error occured at: " + url);
      }
    }
  }
}

await scrape(website);
if (recursive) {
  await followLinks(depth);
}

