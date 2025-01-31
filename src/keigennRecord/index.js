"use strict";
import { getJobByID } from "../../resources/data/job";
import { status } from "../../resources/data/status";
import { getDamage } from "../../resources/function/damage";
import { logProcessing } from "../../resources/function/logProcessing";
import { keigenns as playerKeigenns } from "./keigenns";
import { actionChinese } from "../../resources/data/actionChinese";
import "../../resources/function/xianyu";
import "../../resources/function/loadComplete";
import "./index.scss";
import "../../resources/function/isOverlayPlugin";
import "../../resources/function/loadOverlayPluginCommon.js";

const params = new URLSearchParams(new URL(window.location).search);
let MiniMode = params?.get("mini") === "true" || false;
let AutoClean = params?.get("autoclean") === "true" || false;
if (!MiniMode) { 
  import("./index.scss") ;
}
else {
  import("./index_mini.scss");
}
 
const body = document.body;
const main = document.querySelector("main");
document.querySelector("body main table th:nth-child(1)").style.width = params?.get("th1") ?? "36px";
document.querySelector("body main table th:nth-child(2)").style.width = params?.get("th2") ?? "75px";
document.querySelector("body main table th:nth-child(3)").style.width = params?.get("th3") ?? "34px";
document.querySelector("body main table th:nth-child(4)").style.width = params?.get("th4") ?? "46px";
let party = [],
  youID = "",
  playerName = "",
  duration = "00:00",
  FFXIVObject = {},
  scrollMove = true,
  inCombat = false,
  combatTimer = 0,
  maxLength = parseInt(params?.get("maxLength") || 800),
  is24Mode = params?.get("24Mode") === "true" || false;
class FFObject {
  constructor(id, name) {
    this.ID = id;
    this.Name = name;
    this.Status = {};
  }
}
if (!MiniMode) {
  main.style.backgroundColor = `rgba(5,5,5,${params?.get("bgOpacity") || 0.45})`;
  body.style.opacity = params?.get("bodyOpacity") || 1;
}
body.style.fontSize = params?.get("fontSize") || "12px";
function addFooter() {
  document.querySelector(
    "body > footer > ul"
  ).innerHTML = `<li class="select" data-select="true" data-job-name="All" data-reality-name="All" id="all">ALL</li>`;
  if (party.length) {
    document.querySelector("body > footer > ul").append(
      ...party.map((value) => {
        let li = document.createElement("li");
        li.setAttribute("data-reality-name", value.id === youID ? "YOU" : value.name);
        li.setAttribute("data-job-name", value.id === youID ? "YOU" : getJobByID(value.job)?.simple1 ?? "?");
        li.appendChild(document.createTextNode(li.getAttribute("data-job-name")));
        li.setAttribute("data-object-id", value.id);
        li.setAttribute("data-select", "false");
        return li;
      })
    );
  }
  document.querySelectorAll("body > footer > ul > li ").forEach((li) => {
    li.onclick = function () {
      document.querySelectorAll("body > footer > ul > li ").forEach((li) => {
        li.setAttribute("data-select", "false");
        li.classList.remove(`select`);
      });
      this.setAttribute("data-select", "true");
      li.classList.add(`select`);
      document.querySelectorAll("body > main > table > tbody > tr").forEach((element) => {
        if (li.getAttribute("id") === "all" || element.getAttribute("data-master-id") === li.getAttribute("data-object-id")) {
          element.style.display = "table-row";
        } else {
          element.style.display = "none";
        }
      });
    };
    li.oncontextmenu = () =>
      document
        .querySelectorAll("body > footer > ul > li ")
        .forEach(
          (li) =>
            (li.innerText =
              li.innerText === li.getAttribute("data-reality-name")
                ? li.getAttribute("data-job-name")
                : li.getAttribute("data-reality-name"))
        );
  });
}
addOverlayListener("ChangePrimaryPlayer", (e) => {
  youID = e.charID.toString(16).toUpperCase();
  playerName = e.charName;
  addFooter();
});
addOverlayListener("PartyChanged", (e) => {
  party = e.party.filter((p) => p.inParty || is24Mode);
  addFooter();
});
try {
  addOverlayListener("onInCombatChangedEvent", (e) => (e.detail.inACTCombat && !inCombat ? startCombat() : ""));
} catch {
  addOverlayListener("CombatData", (e) => (duration = e.Encounter.duration));
}
function speTr(text, className = null, colSpan = 5) {
  let td = tbody.insertRow(-1).insertCell(0);
  td.innerText = text;
  if (className) td.classList.add(className);
  td.setAttribute("data-type", className);
  td.classList.add("spe");
  td.colSpan = colSpan;
  main.scrollTop = main.scrollHeight;
  return td.parentNode;
}
addOverlayListener("ChangeZone", (e) => {
  FFXIVObject = {};
  if (tbody.lastChild !== null && tbody.lastChild.firstChild.getAttribute("data-type") === "changeZone") tbody.lastChild.remove();
  if(!MiniMode)
    speTr(e.zoneName, "changeZone");
    if (AutoClean) { 
      cleanTable();
  }
  inCombat = false;
  clearTimeout(combatTimer);
  duration = "00:00";
});
addOverlayListener("onPartyWipe", () => {
  FFXIVObject = {};
  if (!MiniMode) {
    speTr("团灭", "ace");
  }
  else { 
    let aceTr = speTr(`🗑️团灭了！`, "deathEvent", 4);;
    aceTr.insertCell(0).innerHTML = duration; //战斗时间
  }
  inCombat = false;
  clearTimeout(combatTimer);
  duration = "00:00";
});
const tbody = document.querySelector("body > main > table > tbody");
addOverlayListener("LogLine", (e) => {
  switch (e.line[0]) {
    case "21":
    case "22":
      let damageLog = getDamage(e);
      if (
        damageLog.type === "damage" &&
        damageLog.fromIsEnemy &&
        damageLog.targetisFriendly &&
        (damageLog.targetID === youID || party.some((value) => value.id === damageLog.targetID && (value.inParty || is24Mode)))
      ) {
        if (!inCombat && duration === "00:00") startCombat();
        if (maxLength > 0 && tbody.childElementCount >= maxLength) {
          tbody.deleteRow(0);
        }
        let tr = tbody.insertRow(-1);
        tr.setAttribute("data-master-id", damageLog.targetID);
        tr.setAttribute("data-master-name", damageLog.targetName);
        if (
          document.querySelector("#all").getAttribute("data-select") === "true" ||
          document.querySelector(`body > footer > ul > li[data-object-id="${damageLog.targetID}"]`).getAttribute("data-select") === "true"
        ) {
          tr.style.display = "table-row";
        } else {
          tr.style.display = "none";
        }
        let td1 = tr.insertCell(0); //时间
        let td2 = tr.insertCell(1); //技能名
        let td3 = tr.insertCell(2); //目标
        let td4 = tr.insertCell(3); //伤害值
        let td5 = tr.insertCell(4); //状态
        let td5inside = document.createElement("article");
        td1.innerHTML = duration; //战斗时间
        td2.innerHTML = /unknown_/i.test(damageLog.skillName)
          ? "未知"
          : actionChinese?.[parseInt(damageLog.skillID, 16)] ?? damageLog.skillName ?? "未知";
        try {
          if (damageLog.targetID === youID) {
            td3.innerText = "YOU";
            td3.classList.add("YOU");
          } else {
            let job = getJobByID(party.find((p) => p.id === damageLog.targetID)?.job);
            td3.innerText = job?.simple2 ?? "?";
            td3.classList.add(job?.en);
          }
        } catch (e) {
          console.warn(e);
          td3.innerHTML = damageLog.targetName;
        }
        td4.innerHTML = damageLog.value.toLocaleString();
        td4.setAttribute("data-damage-effect", damageLog.damageEffect);
        td4.title = damageLog.fromName;
        td4.classList.add(damageLog.damageType);
        function createImg(type, key, stack = 0) {
          let span = document.createElement("span");
          let img = new Image();
          img.style.height = parseInt(params?.get("imgHeight") ?? 20) + 5 + "px";
          let statusNow = status[parseInt(key, 16)] ?? { "CN": "未知", "url": "000000/000405" };
          img.src = `https://cafemaker.wakingsands.com/i/${stackUrl(statusNow.url)}.png`;
          function stackUrl(url) {
            return stack > 1 && stack <= 16
              ? url.substring(0, 7) + (Array(6).join(0) + (parseInt(url.substring(7)) + stack - 1)).slice(-6)
              : url;
          }
          img.title = FFXIVObject[damageLog[type]].Status[key].name;
          if (playerKeigenns?.[key]?.[damageLog.damageType] === 0) {
            span.classList.add("useless");
          } else if (playerKeigenns?.[key]?.[damageLog.damageType] === 0.5) {
            span.classList.add("halfUseful");
          }
          span.appendChild(img);
          let seconds = document.createElement("aside");
          seconds.style.width = ((parseInt(img.style.height) / 32) * 24) / 0.75 + "px";
          if (FFXIVObject[damageLog[type]].Status[key].caster === playerName) seconds.classList.add("playerself");
          try {
            seconds.innerText = Math.round((FFXIVObject[damageLog[type]]?.Status[key]?.expiration - new Date().getTime()) / 1000);
          } catch {
            seconds.innerText = "";
          }
          span.appendChild(seconds);
          td5inside.appendChild(span);
        }
        if (FFXIVObject[damageLog["targetName"]]) forStatus("targetName");
        if (FFXIVObject[damageLog["fromName"]]) forStatus("fromName");
        td5.appendChild(td5inside);
        function forStatus(c) {
          for (const key in FFXIVObject[damageLog[c]].Status) {
            createImg(c, key, parseInt(FFXIVObject[damageLog[c]].Status[key].stack));
          }
        }
        if (
          scrollMove &&
          (document.querySelector("#all").getAttribute("data-select") === "true" ||
            document.querySelector(`body > footer > ul > li[data-object-id="${damageLog.targetID}"]`).getAttribute("data-select") ===
              "true")
        ) {
          main.scrollTop = main.scrollHeight;
        }
        tr.onclick = () => {
          let result = [];
          result.push(tr.children[0].innerHTML);
          result.push(tr.children[3].title);
          result.push(tr.children[1].innerHTML);
          result.push(tr.getAttribute("data-master-name"));
          result.push(tr.children[3].innerHTML);
          for (const kg of tr.querySelectorAll("td>article>span>img")) result.push(kg.title);
          document.querySelector("#toCopy").value = result.join(" ");
          document.querySelector("#toCopy").select();
          document.execCommand("copy");
          document.querySelector("#hint").innerText = "已复制！";
          document.querySelector("#hint").classList.add("anim-opacity2");
          setTimeout(() => document.querySelector("#hint").classList.remove("anim-opacity2"), 1000);
        };
      }
      break;
    case "26":
    case "30":
      let statusLog = logProcessing(e.line, "status");
      const logStatus = statusLog["statusID"].toLowerCase();
      const statusCN = status[parseInt(logStatus, 16)]?.CN ?? "";
      let playerKeigenn = /(受伤|耐性|防御力)(提升|(大幅)?降低|低下|加重|减轻)|最大体力/.test(statusCN)
        ? { dodge: 1, physics: 1, magic: 1, darkness: 1, condition: "player" }
        : playerKeigenns?.[logStatus];
      if (
        playerKeigenn !== undefined &&
        ((playerKeigenn?.condition === "player" &&
          (party.some((value) => value.id === statusLog["targetID"]) || statusLog["targetID"] === youID)) ||
          (playerKeigenn?.condition === "enemy" && statusLog["targetID"].substring(0, 1) === "4"))
      ) {
        if (e.line[0] === "26") {
          FFXIVObject[statusLog["targetName"]] =
            FFXIVObject[statusLog["targetName"]] || new FFObject(statusLog["targetID"], statusLog["targetName"]);
          FFXIVObject[statusLog["targetName"]].Status[logStatus] = {
            name: statusCN ?? statusLog["statusName"],
            caster: statusLog["casterName"],
            stack: e.line[9] > 1 ? e.line[9] : 0,
            expiration: new Date().getTime() + Number(statusLog["statusTime"]) * 1000,
          };
        } else {
          try {
            delete FFXIVObject[statusLog["targetName"]].Status[logStatus];
          } catch {}
        }
      }
      break;
    case "25":
      if (e.line[2] === youID || party.some((p) => p.id === e.line[2] && (p.inParty || is24Mode))) {
        let target;
        try {
          target = e.line[2] === youID ? "你" : getJobByID(party.find((p) => p.id === e.line[2])?.job)?.simple2 ?? "unknown";
        } catch {
          target = e.line[3];
        }
        let deathTr = speTr(`💀${target}被${e.line[5]}做掉了！`, "deathEvent", 4);
        deathTr.setAttribute("data-master-id", e.line[2]);
        deathTr.setAttribute("data-master-name", e.line[3]);
        if (
          document.querySelector("#all").getAttribute("data-select") === "true" ||
          document.querySelector(`body > footer > ul > li[data-object-id="${e.line[2]}"]`).getAttribute("data-select") === "true"
        ) {
          deathTr.style.display = "table-row";
        } else {
          deathTr.style.display = "none";
        }
        deathTr.insertCell(0).innerHTML = duration; //战斗时间
      }
    default:
      break;
  }
});
startOverlayEvents();
main.onscroll = (e) => {
  scrollMove = main.scrollHeight - body.offsetHeight - e.target.scrollTop < body.clientHeight;
};
document.querySelector("header").onclick = function () {
  let m = document.querySelector("main");
  let f = document.querySelector("footer");
  if (m.style.opacity === "0") {
    m.style.opacity = "1";
    f.style.opacity = "1";
    this.classList.remove(`hide`);
    // this.style.opacity = "0.75";
  } else {
    m.style.opacity = "0";
    f.style.opacity = "0";
    this.classList.add(`hide`);
    // this.style.opacity = "1";
  }
};
function startCombat() {
  main.scrollTop = main.scrollHeight;
  inCombat = true;
    if (AutoClean) { 
      cleanTable();
  }
  clearTimeout(combatTimer);
  let d = 0;
  combatTimer = setInterval(() => {
    duration = `${parseInt(++d / 60)
      .toString()
      .padStart(2, "0")}:${parseInt(d % 60)
      .toString()
      .padStart(2, "0")}`;
  }, 1000);
}
function cleanTable() { 
  var tbody = document.querySelector("body > main > table > tbody");
  while (tbody.firstChild) {
  tbody.removeChild(tbody.lastChild);
  }
}
