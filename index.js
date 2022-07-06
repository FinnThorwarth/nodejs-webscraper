const PORT = 8080
const axios = require('axios')
const cheerio = require('cheerio')
const express = require('express')
var mysql = require('mysql');
const cors = require('cors')
var _ = require('lodash'); // Lib for comparing two arrays
const Wappalyzer = require('wappalyzer'); // Lib for analyzeing websites
const puppeteer = require('puppeteer'); // Lib for simulating a browser
const app = express()
app.use(cors())


//import urls from './urls.json'
const urls = require('./src/urls.json')

//import config from './src/config.json'
const config = require('./src/config.json');
const console = require('console');

app.get('/', function (req, res) {
  res.json('WG Webscraper')
})

app.get('/results', (req, res) => {
  getWEData()
  res.json('WG Webscraper')
})

// Database Connection
var connection = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database
});

// safe to database
function safeBasicInformationsToDatabase(data) {
  // check if data is already in database
  connection.query('SELECT * FROM Projekte WHERE URL = ' + mysql.escape(data.url), function (err, result) {
    if (err) throw err;
    if (result.length === 0) {
      // insert data into database with mysql
      connection.query('INSERT INTO Projekte (Name,URL,URLAPI) VALUES (' + mysql.escape(data.name) + ',' + mysql.escape(data.url) + ',' + mysql.escape(data.urlAPI) + ')', function (err, result) {
        if (err) throw err;
        console.log('Eintrag erstellt');
      });
    } else {
      // console.log('Eintrag vorhanden')
      // get id from the result object
      var id = result[0].ID;

      //update data where id is equal to id
      connection.query('UPDATE Projekte SET Name = ' + mysql.escape(data.name) + ', URL = ' + mysql.escape(data.url) + ', URLAPI = ' + mysql.escape(data.urlAPI) + ' WHERE ID = ' + mysql.escape(id), function (err, result) {
        if (err) throw err;
        console.log('Haupteintrag aktualisiert');
      });

      // insert results into database only if the last insert by id is different from the current insert
      connection.query('SELECT * FROM Resultate WHERE Projekt_ID = ' + id + ' ORDER BY Result_ID DESC LIMIT 1', function (err, result) {
        if (err) throw err;

        if (result.length === 0) {
          // insert data into database with mysql
          connection.query('INSERT INTO Resultate (Projekt_ID,Result,WE,PHP,SQLVersion) VALUES (' + id + ',' + mysql.escape(JSON.stringify(data.versions)) + ',' + mysql.escape(data.versions.version) + ',' + mysql.escape(data.versions.phpVersion) + ',' + mysql.escape(data.versions.sqlVersion) + ')', function (err, result) {
            if (err) throw err;
            console.log('Versionseintrag erstellt');
          });
        } else if (!_.isEqual(result[0].Result, JSON.stringify(data.versions))) {
          console.log('Versionseintrag vorhanden')
        } else {
          connection.query('INSERT INTO Resultate (Projekt_ID,Result,WE,PHP,SQLVersion) VALUES (' + id + ',' + mysql.escape(JSON.stringify(data.versions)) + ',' + mysql.escape(data.versions.version) + ',' + mysql.escape(data.versions.phpVersion) + ',' + mysql.escape(data.versions.sqlVersion) + ')', function (err, result) {
            if (err) throw err;
            console.log('Versionseintrag geschrieben');
          });
        }
      });
    }
  });
}

function safeTechnicalVersionsToDatabase(data, url) {
  // check if data is already in database
  connection.query('SELECT * FROM Projekte WHERE URL = ' + mysql.escape(url), function (err, result) {
    if (err) throw err;
    if (result.length > 0) {
      // get id from the result object
      var id = result[0].ID;

      // get the newest result from the database with the id
      connection.query('SELECT * FROM Resultate WHERE Projekt_ID = ' + id + ' ORDER BY Result_ID DESC LIMIT 1', function (err, result) {
        if (err) throw err;
        if (result.length > 0) {
          // get the id out of request
          var id = result[0].Result_ID;

          // update data in database where id is equal id
          connection.query('UPDATE Resultate SET Technologies = ' + mysql.escape(JSON.stringify(data.technologies[0])) + ', URLS = ' + mysql.escape(JSON.stringify(data.urls)) + ' WHERE Result_ID = ' + id, function (err, result) {
            if (err) throw err;
            console.log('Technologieeintrag aktualisiert');
          });
        }
      });
    }
  });
}

function getLibarys(url) {
  const Wappalyzer = require('wappalyzer');

  const options = {
    debug: false,
    delay: 500,
    headers: {},
    maxDepth: 3,
    maxUrls: 20,
    maxWait: 10000,
    recursive: true,
    probe: true,
    proxy: false,
    userAgent: 'Wappalyzer',
    htmlMaxCols: 2000,
    htmlMaxRows: 2000,
    noScripts: false,
    noRedirect: false,
  };

  const wappalyzer = new Wappalyzer(options)

    ; (async function () {
      try {
        await wappalyzer.init()

        // Optionally set additional request headers
        const headers = {}

        const site = await wappalyzer.open(url, headers)

        // Optionally capture and output errors
        site.on('error', console.error)

        const results = await site.analyze()

        //console.log(JSON.stringify(results, null, 2))

        // write results to database
        safeTechnicalVersionsToDatabase(results, url);

      } catch (error) {
        console.error(error)
      }

      await wappalyzer.destroy()
    })()
}

// running function for every entry in urls
// define function 
function getWEData() {
  urls.forEach(urlData => {
    axios(urlData.urlAPI)
      .then(response => {
        const json = response.data

        // get status code
        const statusCode = response.status

        // Daten definieren
        const data = {}
        data.name = urlData.name
        data.url = urlData.url
        data.urlAPI = urlData.urlAPI
        data.versions = json

        // safe to database
        if (statusCode === 200 && JSON.stringify(data.versions).length > 0 && data.versions.version != null) {
          safeBasicInformationsToDatabase(data);
        }

      }).catch(err => console.log(err))

    // getLibarys
    getLibarys(urlData.url);
  })
}


function getWEIncludes() {
  urls.forEach(urlData => {
    axios(urlData.urlAPI)
      .then(response => {
        const html = response.data
        const $ = cheerio.load(html)
        const data = {}
        $('h1', html).each(function () { //<-- cannot be a function expression
          data.title = $(this).text()
          data.name = urlData.name
          data.url = urlData.url
          data.urlAPI = urlData.urlAPI
        })
        console.log(data)
        console.log(urlData.name)
        // safe to database
        safeBasicInformationsToDatabase(data);

      }).catch(err => console.log(err))
  })
}


// run function every 24 hours
setInterval(() => {
  getWEData()
}, 1000 * 60 * 60 * 12) //ms * s * m * h



app.listen(PORT, () => console.log(`server running on PORT ${PORT}`))

