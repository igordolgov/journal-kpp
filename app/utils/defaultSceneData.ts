// app/utils/defaultSceneData.ts
// [№52-ДЕФОЛТНАЯ-СЦЕНА] Репорт: «можно ли сразу по умолчанию загружать мою
// сцену?» — сцена заказчика (дорога с трафиком 1286x101.4, откатные ворота
// 528..750, калитка 758..827, панели управления) зашита в сборку и грузится,
// когда своих сцен ещё нет: пустой IndexedDB 'scenes' И пустом
// journal_kpp_last_scene. Существующие установки ничего не теряют: их
// последняя сцена (localStorage) имеет приоритет над дефолтной.
// Сцена проходит normalizeScene при загрузке (дозаполнение полей).

import type { SceneConfig } from '../types/scene'

export const DEFAULT_KPP_SCENE: SceneConfig = {
  "id": "scene_default_kpp",
  "name": "КПП — базовая сцена",
  "settings": {
    "width": 1280,
    "height": 350,
    "bgColor": "#152129",
    "borderColor": "#94a3b8"
  },
  "elements": [
    {
      "id": "el_7nei6wz4t",
      "name": "Дорога с трафиком",
      "type": "actor",
      "x": -7,
      "y": 1.5999755859375,
      "width": 1286,
      "height": 101.4000244140625,
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
      "x": 528,
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
        "barSpacing": 10,
        "barColor": "#636974"
      }
    },
    {
      "id": "el_degcss4x3",
      "name": "Калитка",
      "type": "actor",
      "x": 758,
      "y": 124,
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
        "barColor": "#636974"
      }
    }
  ],
  "panels": [
    {
      "id": "p_u2mfb5f0d",
      "title": "Панель",
      "x": 22.79998779296875,
      "y": 131,
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
            "hotkey": "1",
            "labelPosition": "bottom",
            "fontSize": 14,
            "labelBg": "white",
            "labelMarginTop": 9
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
            "hotkey": "4",
            "labelPosition": "bottom",
            "labelBg": "white",
            "fontSize": 14,
            "labelMarginTop": 9
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
            "labelMarginTop": 9
          }
        }
      ]
    },
    {
      "id": "p_1emh7cnav",
      "title": "Панель",
      "x": 914,
      "y": 130.79998779296875,
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
      ]
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
  "lifeConfig": {}
}
