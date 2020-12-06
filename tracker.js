/**
 * SCE Tracking Script
 */
function isTorUser(fingerprintData) {
  let score = 0
  let screenResolution;
  let availableScreenResolution;
  let timezoneOffset;

  Object.keys(fingerprintData).forEach((key, index) => {
    if (fingerprintData[key].key == "timezoneOffset") {
      timezoneOffset = fingerprintData[key].value
    }
    if (fingerprintData[key].key == "screenResolution") {
      screenResolution = fingerprintData[key].value
    }
    if (fingerprintData[key].key == "availableScreenResolution") {
      availableScreenResolution = fingerprintData[key].value
    }
  })

  if (navigator.plugins === undefined || navigator.plugins.length == 0) {
    score++
  }
  if (screenResolution[0] == availableScreenResolution[0] &&
    screenResolution[1] == availableScreenResolution[1]) {
    score++
  }
  if (timezoneOffset.toString() == '0') {
    score++
  }
  if (score == 3) {
    return true
  } else {
    return false;
  }
}

async function loadScript() {
  try {

    //options needed for creating fingerprint from Fingerprint2 library
    var optionsForFingerprint = {
      preprocessor: null,
      audio: {
        timeout: 1000,
        excludeIOS11: true
      },
      fonts: {
        swfContainerId: 'fingerprintjs2',
        swfPath: 'flash/compiled/FontList.swf',
        userDefinedFonts: [],
        extendedJsFonts: false
      },
      screen: {
        detectScreenOrientation: true
      },
      plugins: {
        sortPluginsFor: [/palemoon/i],
        excludeIE: false
      },
      extraComponents: [],
      excludes: {
        'enumerateDevices': true,
        'pixelRatio': true,
        'doNotTrack': true,
        'fontsFlash': true,
        'userAgent': true,
        'plugins': true,
        'fonts': true,
        'webdriver': true,
        'deviceMemory': true,
        'adBlock': true,

      },
      NOT_AVAILABLE: 'not available',
      ERROR: 'error',
      EXCLUDED: 'excluded'
    }

    var fingerprintData;

    //try to load fingerprint from library
    let loadFingerprintPromise = new Promise((res, rej) => {
      if (window.requestIdleCallback) {
        requestIdleCallback(function() {
          Fingerprint2.get(optionsForFingerprint, function(components) {
            fingerprintData = components
            res("fingerprint loaded")
          })
        })
      } else {
        setTimeout(function() {
          Fingerprint2.get(optionsForFingerprint, function(components) {
            fingerprintData = components
            res("fingerprint loaded")
          })
        }, 500)
      }
    })
    try {
      let res = await loadFingerprintPromise
    } catch (e) {
      console.error("Error with loading fingerprint: " + e)
    }

    var sce = (window.sce = window.sce || []);
    var eventBuffer = new Array();

    sce.ignoreTypeAttributes = (sce.ignoreTypeAttributes = sce.ignoreTypeAttributes || []);
    sce.ignoreNameAttributes = (sce.ignoreNameAttributes = sce.ignoreNameAttributes || []);
    sce.ignoreTypeEvents = (sce.ignoreTypeEvents = sce.ignoreTypeEvents || []);

    var IGNORE_TYPE_ATTRIBUTES = ["password"].concat(sce.ignoreTypeAttributes);
    var IGNORE_NAME_ATTRIBUTES = [].concat(sce.ignoreNameAttributes);
    var IGNORE_TYPE_EVENTS = [].concat(sce.ignoreTypeEvents);
    console.log("Ignoring events: "+IGNORE_TYPE_EVENTS)

    function getCookie(name) {
      var cookies = {};
      document.cookie.split("; ").forEach(function(cookie) {
        cookies[cookie.split("=")[0]] = cookie.split("=")[1];
      })
      return cookies[name];
    }

    sce.grantTrackingPermission = function() {
      if (sce.permissionCookieName) {
        document.cookie = sce.permissionCookieName + "=true";
        console.info("Tracking permission enabled");
      }
    }

    sce.rejectTrackingPermission = function() {
      if (sce.permissionCookieName) {
        document.cookie = sce.permissionCookieName + "=false";
        console.info("Tracking permission disabled");
      }
    }

    sce.checkTrackingPermission = function() {
      return sce.permissionCookieName && (getCookie(sce.permissionCookieName) === "true");
    }

    function getCookie(name) {
      var cookies = {};
      document.cookie.split("; ").forEach(function(cookie) {
        cookies[cookie.split("=")[0]] = cookie.split("=")[1];
      })
      return cookies[name];
    }

    sce.println = function(msg) {};

    sce.handleCorrect = function(response) {
      sce.println("Data was sent to the remote server. Response: " + response);
    };

    sce.handleNotCorrect = function(response) {
      sce.println("Data wasn't sent to the remote server. Response: " + response);
    };

    sce.xdrCall = function(url, method, data, key, callback, errback) {
      if (XMLHttpRequest && "withCredentials" in new XMLHttpRequest()) {
        var request = new XMLHttpRequest();
        request.open(method, url, true);
        request.withCredentials = true;
        request.onerror = errback;
        request.onload = function() {
          if (request.status >= 200 && request.status < 400) {
            callback(request.responseText);
            if (getCookie("sceuidjs") === undefined) {
              document.cookie = "sceuidjs=" + JSON.parse(request.responseText).sceuid + ";max-age=31104000;" + "path=/;";
              eventBuffer.forEach(item => {
                item.__additional.cookie = document.cookie
                sce.xdrCall(
                  url,
                  "POST",
                  item,
                  sce.writeKey,
                  sce.handleCorrect,
                  sce.handleNotCorrect
                )
              })
            }
          } else {
            errback("Response returned with non-OK status");
          }
        };
        request.setRequestHeader(
          "Content-Type",
          "application/json; charset=UTF-8"
        );
        request.setRequestHeader("Accept", "application/json");
        request.withCredentials = true
        request.send(JSON.stringify(data));
      } else if (XDomainRequest) {
        var request = new XDomainRequest();
        request.open(method, url);
        request.onerror = errback;
        request.onload = function() {
          callback(request.responseText);
        };
        request.send(JSON.stringify(data));
      } else {
        errback("CORS not supported");

      }
    };

    sce.seqID = (function() {
      var cntr = 0;
      return function() {
        return cntr++;
      };
    })();

    sce.isDictionary = function(arg) {
      if (!arg) return false;
      if (typeof arg != "object") return false;
      if (Array.isArray(arg)) return false;

      return true;
    };

    sce.sendData = function(eventType, args, timestamp, scenario = 'www_events') {
      if (!sce.writeKey) console.warn("Wrong API key provided");
      if (eventType != undefined && eventType != null && sce.isDictionary(args)) {
        var additional = {
          timestamp: timestamp ? timestamp : new Date().getTime(),
          seq_id: sce.seqID(),
          tab_id: sce.tabid,
          sid: sce.sid,
          sceuidjs: getCookie("sceuidjs"),
          url: location.href,
          referrer: document.referrer,
          screen_h: screen.height,
          screen_w: screen.width,
          language: navigator.userLanguage || navigator.language,
          cookie: document.cookie,
          userAgent: navigator.userAgent,
          uniqueIdentifier: localStorage.getItem('unique_identifier'),
          isLoggedIn: window.localStorage.IsLoggedIn === "true"
        };


        var fingerprint = JSON.stringify(fingerprintData)

        var dataContent = args;
        dataContent.eventType = eventType;
        dataContent.__additional = additional;
        dataContent.__isTorUser = 0
        dataContent.__isFingerprintUndefined = 0


        if (fingerprintData == undefined) {
          dataContent.__isFingerprintUndefined = 1;
        }
        if (isTorUser(fingerprintData)) {
          dataContent.__isTorUser = 1
        }


        let tlsh_browser_independent = new Tlsh(); //doesn't consist of any fields that can vary in different browsers
        let tlsh_browser_semi_independent = new Tlsh(); //consist also of fields which can vary in different browsers (but shouldn't)
        let tlsh_full = new Tlsh(); //consist of all the fields

        let data_for_fingerprint = Object.assign({}, fingerprintData);


        //those variables were used for isTorUser but are not constant in time so we are removing them now
        data_for_fingerprint[4] = 0
        data_for_fingerprint[5] = 0
        data_for_fingerprint[6] = 0
        tlsh_full.update(JSON.stringify(data_for_fingerprint), JSON.stringify(data_for_fingerprint).length + 1)
        tlsh_full.finale()

        data_for_fingerprint[11] = 0 //openDatabase
        data_for_fingerprint[14] = 0 //canvas
        // data_for_fingerprint[15] = 0 //webgl, tego raczej nie powinno siÃƒÆ’Ã¢â‚¬Å¾ wykluczaÃƒÆ’Ã¢â‚¬Å¾, bo niesie ze sobÃƒÆ’Ã¢â‚¬Å¾ najwiÃƒÆ’Ã¢â‚¬Å¾cej informacji
        data_for_fingerprint[22] = 0 //audio
        data_for_fingerprint[16] = 0 //webglVendorAndRenderer
        data_for_fingerprint[0] = 0 //language
        tlsh_browser_semi_independent.update(JSON.stringify(data_for_fingerprint), JSON.stringify(data_for_fingerprint).length + 1)
        tlsh_browser_semi_independent.finale()

        data_for_fingerprint[2] = 0 //hardwareConcurency
        data_for_fingerprint[7] = 0 //sessionStorage
        data_for_fingerprint[8] = 0 //localStorage
        data_for_fingerprint[9] = 0 //indexedDb
        data_for_fingerprint[10] = 0 //addBehaviour
        data_for_fingerprint[10] = 0 //addBehaviour
        tlsh_browser_independent.update(JSON.stringify(data_for_fingerprint), JSON.stringify(data_for_fingerprint).length + 1)
        tlsh_browser_independent.finale()


        dataContent.__fingerprint = {}
        dataContent.__fingerprint.level_0 = tlsh_full.hash();
        dataContent.__fingerprint.level_1 = tlsh_browser_semi_independent.hash();
        dataContent.__fingerprint.level_2 = tlsh_browser_independent.hash();
        dataContent.__dataForFingerprint = fingerprintData

        var url =
          sce.baseUrl +
          "api/scenario/code/remote/score?name=" + scenario + "&key=" +
          sce.writeKey;
        if (getCookie("sceuidjs") === undefined && eventType !== 'set_cookie') {
          eventBuffer.push(dataContent)
        } else {
          sce.xdrCall(
            url,
            "POST",
            dataContent,
            sce.writeKey,
            sce.handleCorrect,
            sce.handleNotCorrect
          );
        }
      } else {
        console.warn("Wrong format of data was passed to the function");
      }
    };

    sce.tabid = Math.random().toString(36).slice(2);

    sce.loadScriptFlag = true;

    sce.buffer.forEach(function(event, index) {
      sce.println("buffer[" + index + "] = " + event);
      sce.sendData(event[1], event[2], event[0]);
    });

    sce.maxScrollY = 0;
    sce.timeSpentOnPage = 0;
    sce.currentCursorPosition = {
      pageX: 0,
      pageY: 0
    };
    sce.enteredCharactersNumber = {}

    var sendScrollEvent;
    var sendMouseMoveEvent;
    var lastKnownScrollPositionY = 0;
    var lastKnownScrollPositionX = 0;
    var maxScrollYPosition = 0;
    var intervals = [0, 5000, 30000, 60000, 300000, 900000];
    var cursorPositionInterval = 500;

    var handleMouseMove = null;

    function shouldEventBeIgnored(eventToIgnore) {
      if (IGNORE_TYPE_EVENTS.includes(eventToIgnore)) {
        return true;
      }
      return false;
    }

    function shouldAttributeBeIgnored(event) {
      if (!event || !event.target) {
        return false;
      }

      if (IGNORE_TYPE_ATTRIBUTES.includes(event.target.type)) {
        console.log("Ignoring event for type attribute: " + event.target.type);
        return true;
      }

      if (IGNORE_NAME_ATTRIBUTES.includes(event.target.name)) {
        console.log("Ignoring event for name attribute: " + event.target.name);
        return true;
      }
      return false;
    }

    sce.handleKeyPress = function(inputName, inputId) {
      if (!sce.enteredCharactersNumber.hasOwnProperty(inputName + "_" + inputId)) {
        sce.enteredCharactersNumber[inputName + "_" + inputId] = 0;
      }
      sce.enteredCharactersNumber[inputName + "_" + inputId]++;
    };

    sce.pageHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );

    sce.handleScroll = function(event) {
      sce.currentCursorPosition.pageX =
        sce.currentCursorPosition.pageX +
        window.scrollX -
        lastKnownScrollPositionX;
      sce.currentCursorPosition.pageY =
        sce.currentCursorPosition.pageY +
        window.scrollY -
        lastKnownScrollPositionY;
      lastKnownScrollPositionY = window.scrollY;
      lastKnownScrollPositionX = window.scrollX;
      if (lastKnownScrollPositionY > maxScrollYPosition) {
        maxScrollYPosition = lastKnownScrollPositionY;
        sce.maxScrollY = maxScrollYPosition + window.innerHeight;
      }
    };


    var setMouseMoveInterval = function(interval) {
      var mouseMoveInterval = setInterval(function() {
        sce.event("cursor_position", {
          cursor_position: {
            x: sce.currentCursorPosition.pageX,
            y: sce.currentCursorPosition.pageY
          }
        });
      }, interval);
      return mouseMoveInterval;
    };
    //sending first request to set sceuidjs
    if (getCookie("sceuidjs") === undefined) {
      sce.event("set_cookie", {});
    }


    //LISTENERS COUNTING VARIABLES
    if (!shouldEventBeIgnored("scroll")) {
    window.addEventListener("scroll", function(event) {
      sce.handleScroll(event)
    });
}
    window.addEventListener("mousemove", function(event) {
      sce.currentCursorPosition.pageX = event.pageX;
      sce.currentCursorPosition.pageY = event.pageY;
    });

    window.addEventListener("load", function() {
      var countTime = setInterval(
        function() {
          (sce.timeSpentOnPage = sce.timeSpentOnPage + 1)
        },
        1000
      );
    });


    if (!shouldEventBeIgnored("keydown")) {
      window.addEventListener("keydown", function(event) {
        if (shouldAttributeBeIgnored(event)){return}
        if (event.keyCode >= 46 && event.keyCode <= 222 || event.keyCode == 8) {
          sce.handleKeyPress(event.target.name, event.target.id);
        }
      });
    }


    if (!shouldEventBeIgnored("paste")) {
      window.addEventListener("paste", function(event) {
        if (event.target && event.target.tagName === "INPUT") {
          sce.enteredCharactersNumber[event.target.name + "_" + event.target.id] += event.clipboardData.getData("Text").length;
        }
      });
    }
    //LISTENERS SENDING EVENTS
    if (!shouldEventBeIgnored("mousePosition")) {
      if (sce.attachEvents.includes("mousePosition")) {
        var body = document.getElementsByTagName("body")[0];
        body.addEventListener("mouseover", function(event) {
          if (shouldAttributeBeIgnored(event)){return}
          clearInterval(handleMouseMove);
          handleMouseMove = setMouseMoveInterval(cursorPositionInterval);
        });
        body.addEventListener("mouseout", function(event) {
          if (shouldAttributeBeIgnored(event)){return}
          clearInterval(handleMouseMove);
        });
      }
    }


    window.addEventListener("time_spent_on_page", function() {
      if (!shouldEventBeIgnored("time_spent_on_page")) {
      intervals.forEach(function(interval) {
        var sendTime = setTimeout(
          function() {
            sce.event("time_spent_on_page", {
              value: sce.timeSpentOnPage
            })
          },
          interval
        );
      });
    }

    });

    window.onload = function() {
      setTimeout(
        function() {
          sce.event("page_view", {
            value: window.location.href
          });
        },
        500
      )
    }

    if (!shouldEventBeIgnored("click")) {
      window.addEventListener("click", function(event) {
        if (shouldAttributeBeIgnored(event)){return}
        if (event.target && event.target.tagName === "A") {
          sce.event("link_click", {
            action: "click",
            url: event.target.href,
            cursor_position: sce.currentCursorPosition,
            time_spent_on_page: sce.timeSpentOnPage
          });
        } else if (event.target && event.target.tagName === "BUTTON") {
          sce.event("button_click", {
            id: event.target.id,
            name: event.target.name,
            value: event.target.value,
            cursor_position: sce.currentCursorPosition,
            time_spent_on_page: sce.timeSpentOnPage
          });
        }
      });
    }

    if (!shouldEventBeIgnored("click")) {
      window.addEventListener("click", function(event) {
        if (shouldAttributeBeIgnored(event)){return}
        if (event.target && event.target.tagName === "INPUT") {
          sce.event("input_click", {
            id: event.target.id,
            name: event.target.name,
            value: event.target.value
          })
        }
      });
    }

    if (!shouldEventBeIgnored("change")) {
      window.addEventListener("change", function(event) {
        if (shouldAttributeBeIgnored(event)){return}
        if (event.target && event.target.tagName === "INPUT") {
          sce.event("input_change", {
            id: event.target.id,
            name: event.target.name,
            value: event.target.value
          })
        }
      });
    }


    // event listener for keyup
    keyList = []
    lastKey = []
    flightTimeList = []
    lastKeyPressedDate = new Date()

    function checkKeyPress(e) {
      if (shouldAttributeBeIgnored(e)){return}
      "use strict";
      e = e || event;
      if (e.type == 'keyup') {
        lastKey[e.keyCode] = 0
        sce.event("input_entered_key", {
          id: event.target.id,
          name: event.target.name,
          value: event.target.value,
          key: e.code,
          timestamp_keydown: keyList[e.keyCode] ? keyList[e.keyCode]:new Date(),
          flight_time: flightTimeList[e.keyCode],
          dwell_time: (new Date() - keyList[e.keyCode]),
          event_info: event
        });

        keyList[e.keyCode] = null
        lastKeyPressedDate = new Date()

      }
      if (event.type == 'keydown') {
        if (lastKey[e.keyCode] == 0 || lastKey[e.keyCode] == undefined) {
          keyList[e.keyCode] = new Date().getTime()
          lastKey[e.keyCode] = 1
          flightTimeList[e.keyCode] = (new Date() - lastKeyPressedDate)
        } else {

        }
      }
    }
    if (!shouldEventBeIgnored("keyup")) {
      window.addEventListener('keyup', checkKeyPress);
    }

    if (!shouldEventBeIgnored("keydown")) {
      window.addEventListener('keydown', checkKeyPress);
    }

    if (!shouldEventBeIgnored( "change")) {
      window.addEventListener("change", function(event) {
        if (shouldAttributeBeIgnored(event)){return}
        if (event.target && event.target.tagName === "SELECT") {
          sce.event("select", {
            id: event.target.id,
            name: event.target.name,
            value: event.target.value,
            cursor_position: {
              x: sce.currentCursorPosition.pageX,
              y: sce.currentCursorPosition.pageY
            },
            time_spent_on_page: sce.timeSpentOnPage
          });
        } else if (event.target && event.target.tagName === "INPUT") {
          if (event.target.type === "checkbox") {
            sce.event("checkbox_check", {
              id: event.target.id,
              name: event.target.name,
              value: event.target.checked,
              label: event.target.value,
              cursor_position: {
                x: sce.currentCursorPosition.pageX,
                y: sce.currentCursorPosition.pageY
              },
              time_spent_on_page: sce.timeSpentOnPage
            });
          } else if (event.target.type === "radio") {
            sce.event("radio", {
              id: event.target.id,
              name: event.target.name,
              value: event.target.value,
              time_spent_on_page: sce.timeSpentOnPage
            })
          }
        }
      });
    }

    if (!shouldEventBeIgnored("paste")) {
      window.addEventListener("paste", function(event) {
        if (shouldAttributeBeIgnored(event)){return}
        if (event.target && event.target.tagName === "INPUT") {
          sce.event("input_paste", {
            id: event.target.id,
            name: event.target.name,
            value: event.clipboardData.getData("Text"),
            entered_characters_number: sce.enteredCharactersNumber[event.target.name + "_" + event.target.id],
            time_spent_on_page: sce.timeSpentOnPage
          });
        }
      });
    }

    if (!shouldEventBeIgnored( "scroll")) {
      window.addEventListener("scroll", function(event) {
        if (shouldAttributeBeIgnored(event)){return}
        window.clearTimeout(sendScrollEvent);
        sendScrollEvent = setTimeout(function() {
          sce.event("scroll", {
            scroll_position_Y: sce.maxScrollY,
            scroll_position_Y_Max: sce.pageHeight
          });
        }, 1000);
      });
    }
  if (!shouldEventBeIgnored( "scroll")) {
    if (sce.attachEvents.includes("mousePosition")) {
        window.addEventListener("scroll", function(event) {
          if (shouldAttributeBeIgnored(event)){return}
          window.clearTimeout(sendMouseMoveEvent);
          sendMouseMoveEvent = setTimeout(function() {
            clearInterval(handleMouseMove);
            handleMouseMove = setMouseMoveInterval(cursorPositionInterval);
          }, 1000);
        });

    }
}
    var inputCounts = {};

    function addEventToSelectedItems(event, className, sendData) {
      eventTargetCSSClasses = event.target.className.split(" ");
      if (event.target && eventTargetCSSClasses.includes(className)) {
        sendData();
      }
    };

    function addEventToInputOfGivenType(event, inputType, sendData) {
      eventTargetCSSClasses = event.target.className.split(" ");
      if (event.target && eventTargetCSSClasses.includes("sce-input") && event.target.type === inputType) {
        sendData();
      }
    };

    function handleKeyPress(event, className) {
      addEventToSelectedItems(event, className, function() {
        if (!inputCounts.hasOwnProperty(event.target.name + "Count")) {
          inputCounts[event.target.name + "Count"] = {
            char_cnt: 0,
            back_cnt: 0
          }
        }
        if (event.code == "Backspace") {
          inputCounts[event.target.name + "Count"].back_cnt++;
        } else if (event.keyCode >= 48 && event.keyCode <= 222) {
          inputCounts[event.target.name + "Count"].char_cnt++;
        }
      });
    }

    function handleInputsChange(event, className) {
      addEventToSelectedItems(event, className, function() {
        if (event.target && event.target.type === "text") {
          if (!inputCounts.hasOwnProperty(event.target.name + "Count")) {
            inputCounts[event.target.name + "Count"] = {
              char_cnt: 0,
              back_cnt: 0
            }
          }
          sce.event(
            "input_change", {
              inputId: event.target.id,
              name: event.target.name,
              value: event.target.value,
              char_cnt: inputCounts[event.target.name + "Count"].char_cnt,
              back_cnt: inputCounts[event.target.name + "Count"].back_cnt
            }
          );
        }
      });
    }

    function handleInputPaste(event, className) {
      addEventToSelectedItems(event, className, function() {
        if (!inputCounts.hasOwnProperty(event.target.name + "Count")) {
          inputCounts[event.target.name + "Count"] = {
            char_cnt: 0,
            back_cnt: 0
          }
        }
        inputCounts[event.target.name + "Count"].char_cnt += event.clipboardData.getData('Text').length;
        sce.event(
          "text_paste", {
            inputId: event.target.id,
            name: event.target.name,
            value: event.target.value + event.clipboardData.getData('Text'),
            char_cnt: inputCounts[event.target.name + "Count"].char_cnt,
            back_cnt: inputCounts[event.target.name + "Count"].back_cnt
          }
        );
      })
    }

    function handleCheckboxCheck(event, className) {
      addEventToSelectedItems(event, className, function() {
        if (event.target && event.target.type === "checkbox") {
          sce.event(
            "agreement_check", {
              inputId: event.target.id,
              name: event.target.name,
              checked: event.target.checked,
            }
          );
        }
      })
    }

    function handleRadioButtonCheck(event, className) {
      addEventToSelectedItems(event, className, function() {
        if (event.target && event.target.type === "radio") {
          sce.event(
            "radio_change", {
              inputId: event.target.id,
              name: event.target.name,
              checked: event.target.checked,
            }
          );
        }
      })
    }

    function handleSelect(className) {
      document.querySelectorAll("." + className + " li").forEach(
        function(li) {
          if (!shouldEventBeIgnored( "click")) {
            li.addEventListener("click", function(event) {
              sce.event(
                "select_change", {
                  inputId: event.target.parentNode.previousSibling.previousSibling.id,
                  select_name: event.target.parentNode.previousSibling.previousSibling.name,
                  selected_option: event.target.innerHTML,
                }
              );
            })
          }
        })
    }


    if (sce.attachEvents.includes("inputChange")) {
      if (!shouldEventBeIgnored("inputChange")) {
        window.addEventListener('focusout', function(event) {
          if (shouldAttributeBeIgnored(event)){return}
          handleInputsChange(event, "sce-input");
        });
      }
      if (!shouldEventBeIgnored("paste")) {
        window.addEventListener('paste', function(event) {
          if (shouldAttributeBeIgnored(event)){return}
          handleInputPaste(event, "sce-input");
        });
      }
      if (!shouldEventBeIgnored( "keyup")) {
        window.addEventListener('keyup', function(event) {
          handleKeyPress(event, "sce-input");
        });
      }
    }

    if (sce.attachEvents.includes("checkboxCheck")) {
      if (!shouldEventBeIgnored( "change")) {
        window.addEventListener('change', function(event) {
          if (shouldAttributeBeIgnored(event)){return}
          handleCheckboxCheck(event, "sce-input");
        });
      }
    }

    if (sce.attachEvents.includes("radioButtonCheck")) {
      if (!shouldEventBeIgnored("change")) {
        window.addEventListener('change', function(event) {
          if (shouldAttributeBeIgnored(event)){return}
          handleRadioButtonCheck(event, "sce-input");
        });
      }
    }


    //geo coordinates
    if (!shouldEventBeIgnored("geo_coordinates")) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const long = position.coords.longitude;
        sce.event('geo_coordinates', {
          latitude: lat,
          longitude: long
        })
      });
    }
  }

    let lastOrientation = 0
    if (!shouldEventBeIgnored( "deviceorientation")) {
      window.addEventListener('deviceorientation', (event) => {
        if (event.alpha && event.beta && event.gamma) {
          if (Date.now() - lastOrientation > 10000) {
            sce.event('compas', {
              alpha: event.alpha,
              beta: event.beta,
              gamma: event.gamma
            })
            lastOrientation = Date.now();
          }
        }
      });
    }
    let lastMotion = 0
    if (!shouldEventBeIgnored( "devicemotion")) {
      window.addEventListener('devicemotion', (event) => {
        if (event.accelerationIncludingGravity.x && event.accelerationIncludingGravity.y && event.accelerationIncludingGravity.z) {
          if (Date.now() - lastMotion > 10000) {
            sce.event('accelerometer', {
              x: event.accelerationIncludingGravity.x,
              y: event.accelerationIncludingGravity.y,
              z: event.accelerationIncludingGravity.z,
            })
            lastMotion = Date.now();
          }
        }
      })
    }


  } catch (e) {}
}






//loading sce script
loadScript()
