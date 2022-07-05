const PORT = 8080
const axios = require('axios')
const cheerio = require('cheerio')
const express = require('express')
var mysql = require('mysql');
const app = express()
const cors = require('cors')
var _ = require('lodash');
app.use(cors())


app.get('/', function (req, res) {
  res.json('WG Webscraper')
})

app.get('/results', (req, res) => {
  getWEData()
  res.json('WG Webscraper')
})

//import config from './src/config.json'
const config = require('./src/config.json')

var connection = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database
});

// safe to database
function safeToDatabase(data) {
  // check if data is already in database
  connection.query('SELECT * FROM Projekte WHERE Name = ' + mysql.escape(data.name), function (err, result) {
    if (err) throw err;
    if (result.length === 0) {
      // insert data into database with mysql
      connection.query('INSERT INTO Projekte (Name,URL,URLAPI) VALUES (' + mysql.escape(data.name) + ',' + mysql.escape(data.url) + ',' + mysql.escape(data.urlAPI) + ')', function (err, result) {
        if (err) throw err;
        console.log('Eintrag erstellt');
      });
    } else {
      console.log('Eintrag vorhanden')
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
        } else if (_.isEqual(result[0].Result,JSON.stringify(data.versions))) {
          // get difference between json objects
          console.log(id + ': ' + result[0].Result);
          console.log(id + ': ' + JSON.stringify(data.versions));
          connection.query('INSERT INTO Resultate (Projekt_ID,Result,WE,PHP,SQLVersion) VALUES (' + id + ',' + mysql.escape(JSON.stringify(data.versions)) + ',' + mysql.escape(data.versions.version) + ',' + mysql.escape(data.versions.phpVersion) + ',' + mysql.escape(data.versions.sqlVersion) + ')', function (err, result) {
            if (err) throw err;
            console.log('Versionseintrag geschrieben');
          });
        } else {
          console.log('Versionseintrag vorhanden')
        }
      }
      );

    }
  });
  // close connection
}

//import urls from './urls.json'
const urls = require('./src/urls.json')

// running function for every entry in urls
// define function 
function getWEData() {
  urls.forEach(urlData => {
    axios(urlData.urlAPI)
      .then(response => {
        const json = response.data
        const data = {}

        // Daten definieren
        data.name = urlData.name
        data.url = urlData.url
        data.urlAPI = urlData.urlAPI
        data.versions = json

        // safe to database
        safeToDatabase(data);

      }).catch(err => console.log(err))
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
        safeToDatabase(data);

      }).catch(err => console.log(err))
  })
}


// run function every 24 hours
setInterval(() => {
  getWEData()
}, 1000 * 3 * 1 * 1)



app.listen(PORT, () => console.log(`server running on PORT ${PORT}`))

