// Verifica a conversao hex -> triplete HSL usada em src/renderer/styles/theme.css.
//
// O Franken UI guarda cor como triplete HSL sem hsl(), pra poder compor alfa:
//   hsl(var(--background) / 0.5)
// Entao a paleta do app aparece duas vezes no theme.css: o hex de sempre e o
// triplete equivalente. Um erro aqui vira "a cor esta quase certa" — o tipo de
// bug que ninguem ve e todo mundo convive.
//
// Rode: node tools/check-theme-tokens.js
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const PALETA = {
  'gray-100': '#121214',
  'gray-200': '#191622',
  'gray-300': '#272234',
  white: '#e1e1e6',
  'gray-500': '#41414d',
  purple: '#5a4b81',
  'light-purple': '#988bc7',
  green: '#67e480',
  orange: '#e89e64',
  pink: '#ff79c6',
  blue: '#78d1e1',
  red: '#e96379',
  yellow: '#e7de79',
}

const hexParaHsl = (hex) => {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

const hslParaHex = (triplete) => {
  const [h, s, l] = triplete.replace(/%/g, '').split(' ').map(Number)
  const sn = s / 100
  const ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2
  const seg = Math.floor(h / 60) % 6
  const rgb = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg]
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round((v + m) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

// 1. round-trip: arredondar pra inteiro nao pode mover mais que 2/255 por canal
for (const [nome, hex] of Object.entries(PALETA)) {
  const volta = hslParaHex(hexParaHsl(hex))
  for (let i = 1; i < 7; i += 2) {
    const a = parseInt(hex.slice(i, i + 2), 16)
    const b = parseInt(volta.slice(i, i + 2), 16)
    assert.ok(
      Math.abs(a - b) <= 2,
      `${nome}: ${hex} -> ${hexParaHsl(hex)} -> ${volta} (canal off por ${Math.abs(a - b)})`,
    )
  }
}

// 2. theme.css declara exatamente os tripletes que essa conversao produz
const css = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/styles/theme.css'), 'utf8')
for (const [nome, hex] of Object.entries(PALETA)) {
  const esperado = hexParaHsl(hex)
  assert.ok(
    css.includes(esperado),
    `theme.css nao contem o triplete de --${nome} (${hex}): esperado "${esperado}"`,
  )
  assert.ok(css.includes(hex), `theme.css nao contem o hex de --${nome}: esperado "${hex}"`)
}

console.log(`OK — ${Object.keys(PALETA).length} tokens conferidos`)
