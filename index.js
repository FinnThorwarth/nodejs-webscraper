const PORT = 8080
const axios = require('axios')
const cheerio = require('cheerio')
const express = require('express')
var mysql = require('mysql2');
const cors = require('cors')
var _ = require('lodash'); // Lib for comparing two arrays
const Wappalyzer = require('wappalyzer'); // Lib for analyzeing websites
const puppeteer = require('puppeteer'); // Lib for simulating a browser
const app = express()
app.use(cors())

// Lib for gql: https://www.npmjs.com/package/graphql-request#install

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
  connection.beginTransaction(function (err) {
    if (err) { throw err; }
    connection.query('INSERT INTO Projekte (Name,URL,URLAPI) VALUES (?,?,?) ON DUPLICATE KEY UPDATE Name=VALUES(Name), URLAPI=VALUES(URLAPI)', [data.name, data.url, data.urlAPI], function (err, result) {
      if (err) {
        return connection.rollback(function () {
          throw err;
        });
      }

      var projectId = result.insertId;
      connection.query('INSERT INTO Resultate (Projekt_ID,Result,WE,PHP,SQLVersion) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE Result=VALUES(Result), WE=VALUES(WE), PHP=VALUES(PHP), SQLVersion=VALUES(SQLVersion)', [projectId, JSON.stringify(data.versions), data.versions.version, data.versions.phpVersion, data.versions.sqlVersion], function (err, result) {
        if (err) {
          return connection.rollback(function () {
            throw err;
          });
        }
        connection.commit(function (err) {
          if (err) {
            return connection.rollback(function () {
              throw err;
            });
          }
          console.log(data.url + ' Eintrag erstellt oder aktualisiert');
        });
      });
    });
  });
}

function safeTechnicalVersionsToDatabase(data, url) {
  // check if data is already in database
  connection.query(`SELECT ID, (SELECT Result_ID FROM Resultate WHERE Projekt_ID = Projekte.ID ORDER BY Result_ID DESC LIMIT 1) AS Result_ID FROM Projekte WHERE URL = ${mysql.escape(url)}`, function (err, result) {
    if (err) throw err;
    if (result.length > 0) {
      var id = result[0].ID;
      var resultId = result[0].Result_ID;
      if (resultId) {
        // update data in database where id is equal id
        connection.query(`UPDATE Resultate SET Technologies = ${mysql.escape(JSON.stringify(data.technologies))}, URLS = ${mysql.escape(JSON.stringify(data.urls))} WHERE Result_ID = ${resultId}`, function (err, result) {
          if (err) throw err;
          console.log(url + ' Technologieeintrag aktualisiert');
        });
      }
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
    maxUrls: 15,
    maxWait: 10000,
    recursive: true,
    probe: true,
    proxy: false,
    userAgent: 'Wappalyzer',
    htmlMaxCols: 5000,
    htmlMaxRows: 5000,
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

  const axiosPromises = urls.map(urlData => {
    return axios(urlData.urlAPI)
      .then(response => {
        // Daten definieren
        const data = {
          name: urlData.name,
          url: urlData.url,
          urlAPI: urlData.urlAPI,
          versions: response.data
        }

        // safe to database
        if (response.status === 200 && JSON.stringify(data.versions).length > 0 && data.versions.version != null) {
          safeBasicInformationsToDatabase(data);
        }

        // getLibarys
        getLibarys(urlData.url);
      });
  });

  Promise.all(axiosPromises)
    .then(() => {
      console.log("All requests completed successfully");
    })
    .catch(err => console.log(err));

}

// run function every 24 hours
setInterval(() => {
  getWEData()
}, 1000 * 60 * 60 * 12) //ms * s * m * h


app.listen(PORT, () => console.log(`server running on PORT ${PORT}`))