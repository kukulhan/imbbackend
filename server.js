require('dotenv').config({ silent: true });

const express = require('express');
const bodyParser = require('body-parser');
const apiTw = require('twit')
const assistant = require('./lib/assistant.js');
const moment = require('moment');
const bcrypt = require('bcrypt');
// << MongoDB setup >>
const db = require("./lib/mongodb.js");
const dbName = "IBM_CHALLENGE";
const collectionName = "USER_IBM";

const db1 = require("./lib/mongodb.js");
const collectionName1 = "USER_CAMPAIGN";

const db2 = require("./lib/mongodb.js");
const collectionName2 = "GLOBAL_CAMPAIGN";

const db3 = require("./lib/mongodb.js");
const collectionName3 = "USER_TWITTER";

const db4 = require("./lib/mongodb.js");
const collectionName4 = "TRAFFIC_MANAGER";

const requestjson = require('request-json');

var getResponse = requestjson.createClient('http://localhost:3000/api/v1/getGlobalCampaign');
var getSession = requestjson.createClient('http://localhost:3000/api/v1/session');
var getUsers = requestjson.createClient('http://localhost:3000/api/v1/getUserTwitter');
var getTrafficM = requestjson.createClient('http://localhost:3000/api/v1/getTrafficManager');
var insertTrafficM = requestjson.createClient('http://localhost:3000/api/v1/insertTrafficManager');
var updateTrafficM = requestjson.createClient('http://localhost:3000/api/v1/updateTrafficManager');


const api_twitter = new apiTw({
  consumer_key: process.env.API_KEY_TWITTER,
  consumer_secret: process.env.API_SECRET_TWITTER,
  access_token: process.env.API_TOKEN_TWITTER,
  access_token_secret: process.env.API_TOKEN_SECRET
})

const port = process.env.PORT || 3000;
const app = express();
app.use(bodyParser.json());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header("Access-Control-Allow-Headers", "Origin,X-Requested-With, Content-Type, Accept,*");
  next();
})


db.initialize(dbName, collectionName, function (dbCollection) {
  app.post('/api/v1/login', (request, response) =>{
    var email = request.body.user_email;
    var password = request.body.user_password;
    dbCollection.findOne({ user_email: email }, (error, result) => {
      if (!error) {
        if (result != null) {
          //console.log(result)
          if (bcrypt.compareSync(password, result.user_password)) {
            getSession.get('', function (err, resM, body) {
              if (!err) {
                response.status(200).json({ tokenIBM: body.token });
              } else {
                console.log(err);
              }
            })
          } else {
            response.status(201).send({ 'status': 'Datos erroneos, verifiquelos de nuevo' });
          }
        } else {
          response.status(400).send({ 'status': 'No existe el usuario' });
        }
      } else {
        console.log(error);
      }
    });
  });

  app.post('/api/v1/createUser', (request, response) => {
    let hash = bcrypt.hashSync(request.body.user_password, 10);
    request.body.user_password = hash;
    var item = request.body;
    dbCollection.insertOne(item, (error, result) => {
      if (error) {
        response.status(400).json({ status: "Existe registro" });
      } else {
        response.status(200).json({ status: "Registro exitoso" });
      }
    });
  });

}, function (err) {
  throw (err);
});


db1.initialize(dbName, collectionName1, function (dbCollection) {


  //Agrega simpatizantes
  app.post("/api/v1/addSympathizers", async (request, response) => {
    const email = request.body.user_email;
    const sym = request.body.sympathizer
    var tokenValidate = await assistant
      .validatewatson('holi', request.body.token)
      .then(result => result)
      .catch(err => console.log("Watson error"));
    if (tokenValidate.token == 200) {
      dbCollection.find().toArray((error, result) => {
        if (!error) {
          if (result != null) {
            for (let valResult of result) {
              if (bcrypt.compareSync(valResult.user_email, email)) {
                dbCollection.findOne({ user_email: valResult.user_email }, (error, result) => {
                  if (!error) {
                    if (result != null) {
                      dbCollection.updateOne({ user_email: valResult.user_email }, { $addToSet: { volunteers: sym } }, (error, result) => {
                        if (!error) {
                          response.status(200).json({ status: "Simpatizante agregado" });
                        } else {
                          response.status(400).json({ status: "No se ha podido agregar al simpatizante" });
                        }
                      })
                    } else {
                      response.status(201).json({ status: "No existe campaña" });
                    }
                  } else {
                    console.log(error);
                  }
                });
              }
            }
          } else {
            response.status(201).json({ status: "No existe campaña" });
          }
        } else {
          console.log(error);
        }
      });
    } else {
      response.status(400).json({ status: "Token expirado" });
    }
  });


  //Obtiene si existe campaña o no
  app.post("/api/v1/deleteCampaign", async (request, response) => {
    const email = request.body.user_email;
    var tokenValidate = await assistant
      .validatewatson('holi', request.body.token)
      .then(result => result)
      .catch(err => console.log("Watson error"));
    //console.log("token " + tokenresult.result);
    if (tokenValidate.token == 200) {
      dbCollection.deleteOne({ user_email: email }, (error, result) => {
        if (!error) {
          if (result != null) {
            response.status(200).json({ status: "Se ha eliminado correctamente la campaña" });
          } else {
            response.status(201).json({ status: "No existe campaña" });
          }
        } else {
          console.log(error);
        }
      });
    } else {
      response.status(400).json({ status: "Token expirado" });
    }
  });


  //Obtiene si existe campaña o no
  app.post("/api/v1/getCampaign", async (request, response) => {
    const email = request.body.user_email;
    var tokenValidate = await assistant
      .validatewatson('holi', request.body.token)
      .then(result => result)
      .catch(err => console.log("Watson error"));
    //console.log("token " + tokenresult.result);
    if (tokenValidate.token == 200) {
      dbCollection.findOne({ user_email: email }, (error, result) => {
        if (!error) {
          if (result != null) {
            var startCampaign = moment().format('YYYY-MM-DD HH:mm:ss');
            var endCampaign = moment(new Date(result.day_finish));
            var secondsDiff = endCampaign.diff(startCampaign, 'seconds');
            if (secondsDiff >= 0) {
              result.isActive = true;
            } else { result.isActive = false; }
            response.status(200).json(result);
          } else {
            response.status(201).json({ status: "No existe campaña" });
          }
        } else {
          console.log(error);
        }
      });
    } else {
      response.status(400).json({ status: "Token expirado" });
    }
  });


  //Obtiene la campala desde el carrito
  app.post("/api/v1/getCampaignList", async (request, response) => {
    const email = request.body.user_email;
    const sympathizer = request.body.sympathizer;
    let isSympathizer = false
    let isOwn = false
    var tokenValidate = await assistant
      .validatewatson('holi', request.body.token)
      .then(result => result)
      .catch(err => console.log("Watson error"));
    if (tokenValidate.token == 200) {
      dbCollection.find().toArray((error, result) => {
        if (!error) {
          if (result != null) {
            for (let valResult of result) {
              if (bcrypt.compareSync(valResult.user_email, email)) {
                dbCollection.findOne({ user_email: valResult.user_email }, (error, result) => {
                  if (!error) {
                    if (result != null) {
                      result.volunteers.forEach((emailSympathizer) => {
                        if (emailSympathizer == sympathizer) {
                          isSympathizer = true
                        }
                      });
                      if (result.user_email == sympathizer) {
                        isOwn = true
                      }
                      result.isOwn = isOwn
                      result.isSympathizer = isSympathizer
                      response.status(200).json(result);
                    } else {
                      response.status(201).json({ status: "No existe campaña" });
                    }
                  } else {
                    console.log(error);
                  }
                });
              }
            }
          } else {
            response.status(201).json({ status: "No existe campaña" });
          }
        } else {
          console.log(error);
        }
      });


    } else {
      response.status(400).json({ status: "Token expirado" });
    }
  });


  //Valida la vigencia de la campaña
  app.post("/api/v1/validateCampaign", async (request, response) => {
    const email = request.body.user_email;
    var tokenValidate = await assistant
      .validatewatson('holi', request.body.token)
      .then(result => result)
      .catch(err => console.log("Watson error"));
    if (tokenValidate.token == 200) {
      dbCollection.findOne({ user_email: email }, (error, result) => {
        if (!error) {
          if (result != null) {

            var startCampaign = moment().format('YYYY-MM-DD HH:mm:ss');
            var endCampaign = moment(new Date(result.day_finish));
            var secondsDiff = endCampaign.diff(startCampaign, 'seconds');

            if (secondsDiff >= 0) {
              response.status(200).json({ status: "La campaña sigue vigente" });
            } else {
              response.status(201).json({ status: "La vigencia de la campaña expiro" });
            }

          } else {
            response.status(400).json({ status: "No existe campaña" });
          }
        } else {
          console.log(error);
        }
      });
    } else {
      response.status(400).json({ status: "Token expirado" });
    }
  });
  //Trae las campanas del cliente, se hace la validacion
  //si tiene o no campanas creadas.
  app.post("/api/v1/listCampaign", async (request, response) => {
    const email = request.body.user_email;
    var tokenValidate = await assistant
      .validatewatson('holi', request.body.token)
      .then(result => result)
      .catch(err => console.log("Watson error"));
    if (tokenValidate.token == 200) {
      dbCollection.findOne({ user_email: email }, (error, result) => {
        if (!error) {
          if (result != null) {
            var setCampaignUser = { 'id_campaign': result.campaign.id_campaign };
            //console.log(setCampaignUser)
            getResponse.post('', setCampaignUser, function (err, resM, body) {
              if (!err) {
                var tmpBody = [];
                for (let getListBody of body) {
                  var flagStatus = false;
                  for (let listBody of getListBody.categories) {
                    if (listBody.id_campaign == result.campaign.id_campaign) {
                      var startCampaign = moment().format('YYYY-MM-DD HH:mm:ss');
                      var endCampaign = moment(new Date(result.day_finish));
                      console.log(result.day_finish)
                      var secondsDiff = endCampaign.diff(startCampaign, 'seconds');
                      if (secondsDiff >= 0) {
                        flagStatus = true;
                        break;
                      }
                    }
                  }
                  if (flagStatus) {
                    getListBody.status_campaign = true;
                  } else {
                    getListBody.status_campaign = false;
                  }
                  tmpBody.push(getListBody)
                }
                response.status(200).send(tmpBody);
              } else {
                console.log(err);
              }
            });
          } else {
            var setCampaignUser = {};
            getResponse.post('', setCampaignUser, function (err, resM, body) {
              if (!err) {
                response.status(200).send(body);
              } else {
                console.log(err);
              }
            });
          }
        } else {
          console.log(error);
        }
      });
    } else {
      response.status(400).json({ status: "Token expirado" });
    }
  });

  //Listado Global
  app.post("/api/v1/listGlobalCampaign", async (request, response) => {
    var tokenValidate = await assistant
      .validatewatson('holi', request.body.token)
      .then(result => result)
      .catch(err => console.log("Watson error"));
    if (tokenValidate.token == 200) {

      dbCollection.find().toArray((error, result) => {
        if (!error) {
          if (result != null) {
            getResponse.post('', {}, function (err, resM, body) {
              if (!err) {
                var tmpBody = [];

                for (let valResult of result) {

                  var startCampaign = moment().format('YYYY-MM-DD HH:mm:ss');
                  var endCampaign = moment(new Date(valResult.day_finish));
                  var secondsDiff = endCampaign.diff(startCampaign, 'seconds');

                  if (secondsDiff <= 0)
                    continue;


                  var tmpNameModule = "";
                  var categoryImage = "";
                  var hashemail = bcrypt.hashSync(valResult.user_email, 10);
                  var flagCategory = false;
                  for (let valBody of body) {
                    for (let valCategories of valBody.categories) {
                      if (valCategories.id_campaign == valResult.campaign.id_campaign) {
                        categoryImage = valCategories.category_images;
                        tmpNameModule = valBody.name_module;
                        console.log(tmpNameModule)
                        flagCategory = true;
                        break;
                      }
                    }
                    if (flagCategory) {
                      break;
                    }
                  }
                  valResult.name_module = tmpNameModule;
                  valResult.image = categoryImage;
                  valResult.volunteers = valResult.volunteers.length;
                  valResult.hash = hashemail

                  tmpBody.push(valResult)
                }


                console.log(tmpBody);

                response.status(200).json(tmpBody);
              } else {
                response.status(400).json({ "status": "error en la consulta" });
                console.log(err)
              }
            })
          }
        } else {
          console.log(error)
        }
      })
    } else {
      response.status(400).json({ status: "Token expirado" });
    }
  });

  app.post('/api/v1/createCampaign', async (request, response) => {
    var hashtags = request.body.campaign.hashtags;
    var tokenValidate = await assistant
      .validatewatson('holi', request.body.token)
      .then(result => result)
      .catch(err => console.log("Watson error"));
    request.body.day_create = moment().format('YYYY-MM-DD HH:mm:ss');
    if (tokenValidate.token == 200) {
      if (request.body.time_campaign == "24") {
        request.body.day_finish = moment(new Date()).add(1, 'd').format('YYYY-MM-DD HH:mm:ss');
      } else if (request.body.time_campaign == "48") {
        request.body.day_finish = moment(new Date()).add(2, 'd').format('YYYY-MM-DD HH:mm:ss');
      } else if (request.body.time_campaign == "72") {
        request.body.day_finish = moment(new Date()).add(3, 'd').format('YYYY-MM-DD HH:mm:ss');
      }
      if (hashtags.indexOf("#FuerzaMexico") < 0){
        hashtags = "#FuerzaMexico " + hashtags;
      }

      if (hashtags.indexOf("#AyudaSismo") < 0){
        hashtags = "#AyudaSismo " + hashtags;
      }

      if (hashtags.indexOf("#Sismo") < 0){
        hashtags = "#Sismo " + hashtags;
      }
      request.body.campaign.hashtags = hashtags.split(' ').join(',');
      var item = request.body;
      console.log(item)
      dbCollection.insertOne(item, (error, result) => {
        if (!error) {
          response.status(200).json({ status: "Registro exitoso" });
        } else {
          response.status(400).json({ status: "Existe campaña asociada al un email existente" });
        }
      });
    } else {
      response.status(400).json({ status: "Token expirado" });
    }
  });
}, function (err) {
  throw (err);
});


db2.initialize(dbName, collectionName2, function (dbCollection) {
  app.post("/api/v1/getGlobalCampaign", (request, response) => {
    var strQuery = "";
    var bodyCampaign = request.body.id_campaign;
    dbCollection.find().sort({ category_id: 1 }).toArray((error, result) => {
      if (!error) {
        if (request.body.id_campaign != null) {
          var tmpResult = []
          result.forEach(function (part, index, getList) {
            tmpResult.categories = []
            getList[index].categories.forEach(function (part2, index2, arrayCategory) {
              if (arrayCategory[index2].id_campaign == bodyCampaign) {
                arrayCategory[index2].status_create = true;
              } else {
                arrayCategory[index2].status_create = false;
              }
              tmpResult.categories.push(arrayCategory[index2]);
            })
            tmpResult.push(getList[index])
          })
          response.json(tmpResult);
        } else {
          response.json(result)
        }
      } else {
        response.status(400);
      }
    });
  });
}, function (err) {
  throw (err);
});

db3.initialize(dbName, collectionName3, function (dbCollection) {
  app.get("/api/v1/getUserTwitter", (request, response) => {
    dbCollection.find().toArray((error, result) => {
      if (!error){
        response.status(200).json(result);
      }else{
        console.log(error);
      }
    })
  })
}, function (err) {
   throw (err);
});

db4.initialize(dbName, collectionName4, function (dbCollection) {
  app.post("/api/v1/getTrafficManager", (request, response) => {
    const user_tw= request.body.user_twitter;
    dbCollection.findOne({user_twitter: user_tw}, (error, result) => {
      if (!error){
        if (result != null){
          response.status(200).json(result);
        }else {
          response.status(201).json({status:"fail"})
        }
      }else{
        console.log(error);
      }
    })
  })

   app.post("/api/v1/insertTrafficManager", (request, response) => {
     const item = {
       user_twitter:request.body.user_twitter,
       date_send:request.body.date_send,
       traffic : 0
     }
     dbCollection.insertOne(item, (error, result) => {
       if (error){
         response.status(400).json({status: "Existe registro" });
       }else{
         response.status(200).json({status: "Registro exitoso"});
       }
     });
   });

   app.put("/api/v1/updateTrafficManager", (request, response) => {
     var itemId = request.body.user_twitter;
     var tmpBody = {
       "user_twitter" : itemId,
       "date_send" : request.body.date_send,
       "traffic" : request.body.traffic
     }
     if (request.body.traffic != null){
       if (request.body.traffic < 3){
         var tmpNum = parseInt(request.body.traffic, 10) + parseInt(1, 10);
         tmpBody.traffic = tmpNum;
         dbCollection.updateOne({ user_twitter: itemId }, { $set: tmpBody }, (error, result) => {
           if (!error){
             response.status(200).json({status: "Actualizacion exitosa"});
           }else{
             console.log(error)
             response.status(400).json({status: "Error actualizacion" });
           }
         });
       }else{
         response.status(201).json({status: "Sobrepaso el limite de envio"});
       }
     }
   });
}, function (err) {
   throw (err);
});



const testConnection = () => {
  return assistant.session()
    .then(sessionid => {
      console.log('Successfully connected to Watson Assistant');
      return 'ok';
    })
    .catch(err => {
      const msg = 'Failed to connect to Watson Assistant';
      console.error(msg);
      console.error(err);
      return msg;
    });
}

const handleError = (res, err) => {
  const status = err.code !== undefined && err.code > 0 ? err.code : 500;
  return res.status(status).json(err);
};

const server = app.listen(port, () => {
  const host = server.address().address;
  const port = server.address().port;
  console.log(`IBM Watson listening at http://${host}:${port}`);
  testConnection();
});



app.get('/', (req, res) => {
  testConnection().then(status => res.json({ status: status }));
});

app.get('/api/v1/session', (req, res) => {
  assistant
    .session()
    .then(sessionid => res.json({ token: sessionid }))
    .catch(err => handleError(res, err));
});

app.post('/api/v1/message', (req, res) => {
  const text = req.body.text || '';
  const sessionid = req.body.sessionid;

  assistant
    .message(text, sessionid)
    .then(result => res.json(result))
    .catch(err => res.json({ "status": "Error de comunicacion con Watson" }));
});

//Function to send direct messages direct by API Twitter
function createEchoTwitter(){
  getUsers.get('', function(err, resM, body){
    if (!err && body != null){
      body.forEach(getBodyElement => {
        getBodyElement.users_twitter.forEach(getElement => {
          getTrafficM.post('', {user_twitter:getElement}, function(errT, resMT, bodyT){
            if(!errT){
              var dateSend = moment().format('YYYY-MM-DD');
              if(resMT.statusCode == 200){
                var dateSendPast = moment(new Date(bodyT.date_send));
                if (dateSendPast.diff(dateSend, 'days') < 0){
                  bodyT.date_send = dateSend;
                  updateTrafficM.put('', bodyT, function(errTTT, resMTTT, bodyTTT){
                    if(resMTTT.statusCode == 200){
                      api_twitter.get('users/show', {screen_name:getElement.replace('@','')}, function(errTTTT, dataTTTT, responseTTTT) {
                        if(responseTTTT.statusCode == 200){
                          var setMessage = createMessageDirect(dataTTTT.id_str, getBodyElement.message_direct);
                          api_twitter.post("direct_messages/events/new", setMessage, function(errorTTTTT, dataTTTTT, responseTTTTT){
                            if(responseTTTTT.statusCode = 200){
                              console.log('success');
                            }
                            else {
                              console.log(errorTTTTT);
                            }
                          });
                        }
                      })
                    }
                  })
                }
              }else{
                var tmpBody = {
                  user_twitter: getElement,
                  date_send: dateSend
                }
                insertTrafficM.post('', tmpBody, function(errTT, resMTT, bodyTT){
                  console.log("registro insertado");
                })
                api_twitter.get('users/show', {screen_name:getElement.replace('@','')}, function(errTTTT, dataTTTT, responseTTTT) {
                  if(responseTTTT.statusCode == 200){
                    var setMessage = createMessageDirect(dataTTTT.id_str, getBodyElement.message_direct);
                    api_twitter.post("direct_messages/events/new", setMessage, function(errorTTTTT, dataTTTTT, responseTTTTT){
                      if(responseTTTTT.statusCode = 200){
                        console.log('success');
                      }
                      else {
                        console.log(errorTTTTT);
                      }
                    });
                  }
                })
              }
            }else{
              console.log(errT)
            }
          })
        });
      })
    }else{
      console.log(err);
    }
  })
};

function createMessageDirect(id_user, direct_message_user){
  const params = {
    event: {
      type: "message_create",
      message_create: {
        target: {
          recipient_id: id_user
        },
        message_data: {
          text: direct_message_user
        }
      }
    }
  };
  return params;
}

setInterval(createEchoTwitter, 5000);
