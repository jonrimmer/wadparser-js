const fs = require('fs');
const path = require('path');
const c1m1buffer = fs.readFileSync(path.resolve(__dirname, './c1m1.wad'), null)
  .buffer;
import { Wad, WadDataView, Level, Line } from './wadparser';

test('Endianness check', () => {
  let arr = Int16Array.of(666);
  let dv = new DataView(arr.buffer);

  if (dv.getInt16(0, true) !== 666) {
    fail('The platform running the tests must be little-endian.');
  }
});

describe('Wad', () => {
  test('constructor', () => {
    const wad = new Wad(c1m1buffer);

    expect(wad.wadFormat).toBe('DOOM');
    expect(wad.wadType).toBe('PWAD');
    expect(wad.numLumps).toBe(11);
    expect(wad.levels.length).toBe(1);
  });
});

describe('WadDataView', () => {
  test('getASCIIString', () => {
    const dv = new WadDataView(
      Uint8Array.of(0, 0, 80, 87, 65, 68, 0, 0).buffer
    );

    expect(dv.getASCIIString(2, 5)).toBe('PWAD');
  });

  test('Negative indicies', () => {
    const dv = new WadDataView(new ArrayBuffer(10));
    dv.setInt16(-2, 666);
    expect(dv.getInt16(-2)).toBe(666);
  });
});

describe('Level', () => {
  test('isValid', () => {
    let level = new Level(null);

    expect(level.isValid()).toBe(false);

    level = new Level('E1M1');

    expect(level.isValid()).toBe(false);

    level.lumps.VERTEXES = {};
    level.lumps.LINEDEFS = {};

    expect(level.isValid()).toBe(true);
  });

  test('load', () => {
    let level = new Level('E1M1');

    level.lumps.VERTEXES = new WadDataView(
      Int16Array.of(5, 5, 10, 5, 10, 10, 5, 10).buffer
    );

    level.lumps.LINEDEFS = new WadDataView(
      Int16Array.of(1, 2, 0, 0, 0, 1, -1, 3, 4, 0, 0, 0, -1, 2).buffer
    );

    level.load();

    expect(level.vertices.length).toBe(4);
    expect(level.lowerLeft).toEqual([5, 5]);
    expect(level.upperRight).toEqual([10, 10]);
    expect(level.shift).toEqual([-5, -5]);

    expect(level.lines.length).toBe(2);
  });

  test('normalize', () => {
    const level = new Level('E1M1');

    level.shift = [-10, -10];

    expect(level.normalize([10, 10], 1)).toEqual([1, 1]);
  });

  test('asSvg', () => {
    let level = new Level('E1M1');

    level.lumps.VERTEXES = new WadDataView(Int16Array.of(0, 0, 10, 10).buffer);

    level.lumps.LINEDEFS = new WadDataView(
      Int16Array.of(0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, -1).buffer
    );

    level.load();

    let svg = level
      .asSvg()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/>\s</g, '><');

    expect(svg).toBe(
      '<svg width="1024" height="1024">' +
        '<line x1="5" y1="5" x2="15" y2="15" />' +
        '<line x1="15" y1="15" x2="5" y2="5" />' +
        '</svg>'
    );
  });
});

describe('Line', () => {
  let line = null;

  test('unpack', () => {
    let dv = new WadDataView(new ArrayBuffer(14));

    dv.setInt16(0, 1);
    dv.setInt16(2, 2);
    dv.setInt16(-4, 3);
    dv.setInt16(-2, -1);

    line = new Line(dv);

    expect(line.a).toBe(1);
    expect(line.b).toBe(2);
    expect(line.leftSide).toBe(3);
    expect(line.rightSide).toBe(-1);

    expect(line.isOneSided).toBe(true);
  });
});
