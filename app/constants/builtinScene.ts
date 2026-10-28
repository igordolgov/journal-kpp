// app/constants/builtinScene.ts
// Назначение: ВСТРОЕННАЯ СЦЕНА ПО УМОЛЧАНИЮ (репорт №51 — «загружать мою
// сцену сразу по умолчанию»). Экспортируется как эталонная:
//   • редактор (useEditorLogic) открывается на ней, если в localStorage ещё
//     нет сохранённой сцены;
//   • док-симулятор (layouts/default.vue) играет её, если в БД (IndexedDB)
//     нет ни одной сохранённой сцены — вместо «Сцена не загружена».
// [№53-РЕЛИЗ-1.0.5] обновлена до сцены заказчика от 28.10.2026: фон
// 1280x350 #374151, фоновая дорога 1286x57, откатные ворота 222x103
// (оффсеты stopExit 94 / crossExit -27 / crossEnter 94 / stopEnter 24,
// barColor #798393), калитка 69x103, два пульта (прозрачность 0.3, blur 5,
// у кнопок калитки прописан targetGateId), трафик сцены: maxAgents 60,
// carHeight 65, спавн машин 10-20 c, spawnIntervalMin 17.
// Файл генерировался скриптом из сцены заказчика; правки вносить аккуратно:
// это обычный SceneConfig.

import type { SceneConfig } from '../types/scene'

export const builtinScene: SceneConfig = {
  "id": "scene_builtin",
  "name": "Новая",
  "settings": {
    "width": 1280,
    "height": 350,
    "bgColor": "#374151",
    "borderColor": "#94a3b8",
    "posX": null,
    "posY": null,
    "traffic": {
      "carSpawnIntervalMin": 10,
      "carSpawnIntervalMax": 20,
      "maxAgents": 60,
      "spawnIntervalMin": 17,
      "carHeight": 65
    },
    "showGrid": false
  },
  "elements": [
    {
      "id": "el_7nei6wz4t",
      "name": "Дорога с трафиком",
      "type": "actor",
      "x": -7.79998779296875,
      "y": 4.800018310546875,
      "width": 1286,
      "height": 57,
      "zIndex": 1,
      "asset": {
        "type": "traffic_road",
        "content": null
      },
      "category": "infrastructure"
    },
    {
      "id": "el_258xlm322",
      "name": "Ворота откатные",
      "type": "actor",
      "x": 529.5999755859375,
      "y": 125,
      "width": 222,
      "height": 103,
      "zIndex": 2,
      "asset": {
        "type": "svg",
        "content": "<svg viewBox=\"0 0 320 120\" preserveAspectRatio=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n    <rect x=\"0\" y=\"0\" width=\"320\" height=\"120\" fill=\"none\" rx=\"2\"/>\n    <g class=\"sliding-panel\">\n      <rect x=\"0\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"12.64\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"25.28\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"37.92\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"50.56\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"63.2\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"75.84\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"88.48\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"101.12\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"113.76\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"126.4\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"139.04000000000002\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"151.68\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"164.32\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"176.96\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"189.60000000000002\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"202.24\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"214.88\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"227.52\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"240.16000000000003\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"252.8\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"265.44\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"278.08000000000004\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"290.72\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"303.36\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"316\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/>\n    </g>\n  </svg>",
        "color": "#fff"
      },
      "category": "gate",
      "settings": {
        "gateType": "sliding",
        "openDuration": 8,
        "closeDuration": 8,
        "barOpacity": 1,
        "barWidth": 2,
        "barColor": "#798393",
        "barSpacing": 10,
        "stopExitCarY": 94,
        "crossExitCarY": -27,
        "crossEnterCarY": 94,
        "stopEnterCarY": 24
      }
    },
    {
      "id": "el_degcss4x3",
      "name": "Калитка",
      "type": "actor",
      "x": 755.7999877929688,
      "y": 125,
      "width": 69,
      "height": 103,
      "zIndex": 3,
      "asset": {
        "type": "svg",
        "content": "<svg viewBox=\"0 0 80 120\" preserveAspectRatio=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n    <rect x=\"0\" y=\"0\" width=\"80\" height=\"120\" fill=\"none\" rx=\"2\"/>\n    <g class=\"wicket-door\" style=\"transform-origin: 0px 60px;\">\n      <rect x=\"0\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"15.2\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"30.4\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"45.599999999999994\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"60.8\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/><rect x=\"76\" y=\"0\" width=\"4\" height=\"120\" fill=\"#9ca3af\" opacity=\"0.9\" rx=\"2\"/>\n      <rect x=\"66\" y=\"52\" width=\"8\" height=\"16\" fill=\"#d97706\" rx=\"2\"/>\n    </g>\n  </svg>",
        "color": "#fff"
      },
      "category": "gate",
      "settings": {
        "gateType": "wicket",
        "barSpacing": 9,
        "barOpacity": 1,
        "barWidth": 2,
        "barColor": "#798393"
      }
    }
  ],
  "scripts": [],
  "variables": [
    {
      "key": "var_cq",
      "value": "0"
    },
    {
      "key": "var_Lr",
      "value": "0"
    }
  ],
  "trafficConfig": {},
  "lifeConfig": {},
  "panels": [
    {
      "id": "p_u2mfb5f0d",
      "title": "Панель",
      "x": 24.400009155273438,
      "y": 132.59991455078125,
      "width": 472,
      "height": 177,
      "dock": "none",
      "controls": [
        {
          "id": "ctrl_1782841169135",
          "type": "button-gate-open",
          "x": 50,
          "y": 50,
          "settings": {
            "width": 80,
            "height": 80,
            "label": "ВОРОТА ОТКРЫТЬ",
            "color": "#009641",
            "textColor": "#000000",
            "borderRadius": 50,
            "actionType": "gate-open",
            "labelPosition": "bottom",
            "fontSize": 14,
            "labelBg": "white",
            "labelMarginTop": 9,
            "hotkey": "1"
          }
        },
        {
          "id": "ctrl_1782841170442",
          "type": "button-stop",
          "x": 50,
          "y": 50,
          "settings": {
            "width": 80,
            "height": 80,
            "label": "ВОРОТА СТОП",
            "color": "#009641",
            "textColor": "#000000",
            "borderRadius": 50,
            "actionType": "gate-stop",
            "hotkey": "2",
            "labelPosition": "bottom",
            "labelBg": "white",
            "fontSize": 14,
            "labelMarginTop": 9
          }
        },
        {
          "id": "ctrl_1782841171386",
          "type": "button-gate-close",
          "x": 50,
          "y": 50,
          "settings": {
            "width": 80,
            "height": 80,
            "label": "ВОРОТА ЗАКРЫТЬ",
            "color": "#009641",
            "textColor": "#000000",
            "borderRadius": 50,
            "actionType": "gate-close",
            "hotkey": "3",
            "labelPosition": "bottom",
            "labelBg": "white",
            "fontSize": 14,
            "labelMarginTop": 9
          }
        },
        {
          "id": "ctrl_1782841182906",
          "type": "button-wicket-open",
          "x": 50,
          "y": 50,
          "settings": {
            "width": 80,
            "height": 80,
            "label": "КАЛИТКА ОТКРЫТЬ",
            "color": "#009641",
            "textColor": "#000000",
            "borderRadius": 50,
            "actionType": "wicket-open",
            "labelPosition": "bottom",
            "labelBg": "white",
            "fontSize": 14,
            "labelMarginTop": 9,
            "hotkey": "4",
            "targetGateId": "el_degcss4x3"
          }
        },
        {
          "id": "ctrl_1782841183602",
          "type": "button-wicket-close",
          "x": 50,
          "y": 50,
          "settings": {
            "width": 80,
            "height": 80,
            "label": "КАЛИТКА ЗАКРЫТЬ",
            "color": "#009641",
            "textColor": "#000000",
            "borderRadius": 50,
            "actionType": "wicket-close",
            "hotkey": "5",
            "labelPosition": "bottom",
            "labelBg": "white",
            "fontSize": 14,
            "labelMarginTop": 9,
            "targetGateId": "el_degcss4x3"
          }
        }
      ],
      "bgOpacity": 0.3,
      "blur": 5
    },
    {
      "id": "p_1emh7cnav",
      "title": "Панель",
      "x": 915,
      "y": 129.20001220703125,
      "width": 297,
      "height": 167,
      "dock": "none",
      "controls": [
        {
          "id": "ctrl_1782841253699",
          "type": "button-intercom",
          "x": 50,
          "y": 50,
          "settings": {
            "width": 60,
            "height": 60,
            "label": "ВОРОТА ВНУТРЕНН",
            "color": "#f0e6b4",
            "borderRadius": 8,
            "actionType": "call",
            "intercomSide": "exit",
            "gradient": "linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 50%), linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
            "labelPosition": "bottom",
            "targetGateId": "el_258xlm322",
            "hotkey": "7",
            "labelMarginTop": 9
          }
        },
        {
          "id": "ctrl_1782841246250",
          "type": "button-intercom",
          "x": 50,
          "y": 50,
          "settings": {
            "width": 60,
            "height": 60,
            "label": "ВОРОТА ВНЕШНИЙ",
            "color": "#f0e6b4",
            "borderRadius": 8,
            "actionType": "call",
            "intercomSide": "enter",
            "gradient": "linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 50%), linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
            "labelPosition": "bottom",
            "targetGateId": "el_258xlm322",
            "hotkey": "8",
            "labelMarginTop": 9,
            "labelPadding": "2px 4px"
          }
        },
        {
          "id": "ctrl_1782841254131",
          "type": "button-intercom",
          "x": 50,
          "y": 50,
          "settings": {
            "width": 60,
            "height": 60,
            "label": "КАЛИТКА ВНУТРЕНН",
            "color": "#f0e6b4",
            "borderRadius": 8,
            "actionType": "call",
            "intercomSide": "exit",
            "gradient": "linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 50%), linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
            "labelPosition": "bottom",
            "targetGateId": "el_degcss4x3",
            "hotkey": "9",
            "labelMarginTop": 9
          }
        },
        {
          "id": "ctrl_1782841252331",
          "type": "button-intercom",
          "x": 50,
          "y": 50,
          "settings": {
            "width": 60,
            "height": 60,
            "label": "КАЛИТКА ВНЕШНИЙ",
            "color": "#f0e6b4",
            "borderRadius": 8,
            "actionType": "call",
            "intercomSide": "enter",
            "gradient": "linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 50%), linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
            "labelPosition": "bottom",
            "targetGateId": "el_degcss4x3",
            "hotkey": "0",
            "labelMarginTop": 9
          }
        }
      ],
      "bgOpacity": 0.3,
      "blur": 5
    }
  ],
  "createdAt": 1773183925080,
  "updatedAt": 1782840005621
}
