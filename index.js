process.setMaxListeners(0)

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
//const urls = require('./src/urls.json')


//import config from './src/config.json'
const config = require('./src/config.json');
const console = require('console');

app.get('/', function (req, res) {
  res.json('WG Webscraper')
})

app.get('/results', (req, res) => {
  getProjects(function (urls) {
    getWEData(urls);
  });
  res.json('WG Webscraper')
})

// Database Connection
var pool = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database
});


// fetch data from database and return it

function getProjects(callback) {
  var urls = [];
  pool.getConnection(function (err, connection) {
    if (err) throw err;
    connection.query('SELECT p.* FROM Projekte p LEFT JOIN Resultate r ON p.ID = r.Projekt_ID ORDER BY r.Date ASC', function (err, result) {
      if (err) throw err;
      result.forEach(function (item) {
        urls.push(item);
        console.log(item);
      });
      callback(urls);
    });
  });
}



// safe to database

function safeBasicInformationsToDatabase(data) {
  pool.getConnection(function (err, connection) {
    if (err) throw err;
    // Check if the URL is already in the database
    connection.query(`SELECT ID FROM Projekte WHERE URL = ${mysql.escape(data.URL)}`, function (err, result) {
      if (err) throw err;
      if (result.length === 0) {
        // URL is not in the database, insert the data
        connection.beginTransaction(function (err) {
          if (err) {
            return connection.rollback(function () {
              throw err;
            });
          }
          connection.query('INSERT INTO Projekte (Name,URL,URLAPI) VALUES (?,?,?)', [data.Name, data.URL, data.URLAPI], function (err, result) {
            if (err) {
              return connection.rollback(function () {
                throw err;
              });
            }
            var projectId = result.insertId;
            connection.query('INSERT INTO Resultate (Projekt_ID,Result,WE,PHP,SQLVersion) VALUES (?,?,?,?,?)', [projectId, JSON.stringify(data.versions), data.versions.version, data.versions.phpVersion, data.versions.sqlVersion], function (err, result) {
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
                console.log(data.URL + ' Versionseintrag erstellt');
                connection.release();
              });
            });
          });
        });
      } else {
        // URL is already in the database, update the data
        connection.beginTransaction(function (err) {
          if (err) {
            return connection.rollback(function () {
              throw err;
            });
          }
          var projectId = result[0].ID;

          // Check if Result is already in the database if not insert it
          connection.query(`SELECT Result_ID FROM Resultate WHERE Projekt_ID = ${projectId} ORDER BY Result_ID DESC LIMIT 1`, function (err, result) {
            if (err) throw err;
            if (result.length === 0) {
              connection.query('INSERT INTO Resultate (Projekt_ID,Result,WE,PHP,SQLVersion) VALUES (?,?,?,?,?)', [projectId, JSON.stringify(data.versions), data.versions.version, data.versions.phpVersion, data.versions.sqlVersion], function (err, result) {
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
                  console.log(data.URL + ' Versionseintrag erstellt');
                  connection.release();
                });
              });
            } else {

              connection.query('UPDATE Resultate SET Result=?, WE=?, PHP=?, SQLVersion=? WHERE Projekt_ID = ?', [JSON.stringify(data.versions), data.versions.version, data.versions.phpVersion, data.versions.sqlVersion, projectId], function (err, result) {
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
                  console.log(data.URL + ' Versionseintrag aktualisiert');
                  connection.release();
                });
              })
            }
          });
        });
      };
    });
  });
}

function safeTechnicalVersionsToDatabase(data, url) {
  // check if data is already in database
  pool.getConnection(function (err, connection) {
    if (err) throw err;
    connection.query(`SELECT ID, (SELECT Result_ID FROM Resultate WHERE Projekt_ID = Projekte.ID ORDER BY Result_ID DESC LIMIT 1) AS Result_ID FROM Projekte WHERE URL = ${mysql.escape(url)}`, function (err, result) {
      if (err) throw err;
      if (result.length > 0) {
        var id = result[0].ID;
        var resultId = result[0].Result_ID;
        if (resultId) {
          // update data in database where id is equal id
          connection.query(`UPDATE Resultate SET Technologies = ${mysql.escape(JSON.stringify(data.technologies))}, URLS = ${mysql.escape(JSON.stringify(data.URLs))} WHERE Result_ID = ${resultId}`, function (err,
            result) {
            if (err) throw err;
            console.log(url + ' Technologieeintrag aktualisiert');
          });
        }
      }
    });
  }
  )
}

function getLibarys(url) {
  const Wappalyzer = require('wappalyzer');

  const options = {
    debug: false,
    delay: 500,
    headers: {},
    maxDepth: 3,
    maxUrls: 15,
    maxWait: 5000,
    recursive: true,
    probe: true,
    proxy: false,
    userAgent: 'Wappalyzer',
    htmlMaxCols: 5000,
    htmlMaxRows: 5000,
    noScripts: false,
    noRedirect: false,
  };

  const wappalyzer = new Wappalyzer(options);
  (async function () {
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
async function getWEData(urls) {

  const batchSize = 5;

  // loop over urls and slice into batches
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    // create promises for each url in batch
    const axiosPromises = batch.map(urlData => {
      return axios(urlData.URLAPI)
        .then(response => {
          // Daten definieren
          const data = {
            Name: urlData.Name,
            URL: urlData.URL,
            URLAPI: urlData.URLAPI,
            versions: response.data
          }

          // safe to database
          if (response.status === 200 && JSON.stringify(data.versions).length > 0 && data.versions.version != null) {
            safeBasicInformationsToDatabase(data);
          }

          // getLibarys
          getLibarys(urlData.URL);
        });
    });

    // wait for all promises in batch to resolve
    await Promise.all(axiosPromises);
  }
  console.log("All requests completed successfully");
}


// run function every 24 hours
setInterval(() => {

  getProjects(function (urls) {
    getWEData(urls);
  });

}, 1000 * 60 * 60 * 12), //ms * s * m * h


  app.listen(PORT, () => console.log(`server running on PORT ${PORT}`))