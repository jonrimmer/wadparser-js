export class Wad {
  constructor(wadfile) {
    const f = new WadDataView(wadfile);
    this.levels = [];
    this.wadFormat = 'DOOM';
    this.wadType = f.getASCIIString(0, 4);
    this.numLumps = f.getInt32(4, true);
    const dirOffset = f.getInt32(8, true);

    let currentLevel = new Level(null);

    for (let i = 0; i < this.numLumps; i++) {
      const lump = new WadDataView(wadfile, dirOffset + (i * 16));

      const filepos = lump.getInt32(0, true);
      const size = lump.getInt32(4, true);
      const name = lump.getASCIIString(8, 8);

      if (/E\dM\d|MAP\d\d/.test(name)) {
        if (currentLevel.isValid()) {
          this.levels.push(currentLevel);
        }
        
        currentLevel = new Level(name);
      }
      else if (name === 'BEHAVIOR') {
        this.wadFormat = 'HEXEN';
      }
      else {
        currentLevel.lumps[name] = new WadDataView(wadfile, filepos, size);
      }
    }

    if (currentLevel.isValid()) {
      this.levels.push(currentLevel);
    }

    this.levels.forEach(level => level.load(this.wadFormat));
  }
}

export class Level {
  constructor(name) {
    this.name = name;
    this.lumps = {};
    this.vertices = [];
    this.lines = [];
    this.lowerLeft = null;
    this.upperRight = null;
  }

  isValid() {
    return (this.name != null) && 'VERTEXES' in this.lumps && 'LINEDEFS' in this.lumps;
  }

  load(wadFormat) {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let data of this.lumps.VERTEXES.packetsOfSize(4)) {
      let vert = [
        data.getInt16(0, true),
        data.getInt16(2, true)
      ];

      this.vertices.push(vert);

      minX = Math.min(vert[0], minX);
      maxX = Math.max(vert[0], maxX);
      minY = Math.min(vert[1], minY);
      maxY = Math.max(vert[1], maxY);
    }

    this.lowerLeft = [ minX, minY ];
    this.upperRight = [ maxX, maxY ];

    this.shift = [
      0 - this.lowerLeft[0],
      0 - this.lowerLeft[1]
    ];

    for (let data of this.lumps.LINEDEFS.packetsOfSize(wadFormat == 'HEXEN' ? 16 : 14)) {
      this.lines.push(new Line(data));
    }
  }

  normalize(vert, padding = 5) {
    return [ this.shift[0] + vert[0] + padding, this.shift[1] + vert[1] + padding ];
  }

  asSvg() {
    const viewBoxSize = this.normalize(this.upperRight, 10);

    let canvasSize;

    if (viewBoxSize[0] > viewBoxSize[1]) {
      canvasSize = [1024, Math.round(1024 * (viewBoxSize[1] / viewBoxSize[0]))];
    }
    else {
      canvasSize = [Math.round((viewBoxSize[0] / viewBoxSize[1]) * 1024), 1024];
    }

    return `
      <svg
        width="${ canvasSize[0] }"
        height="${ canvasSize[1] }"
        viewBox="0 0 ${ viewBoxSize[0] + ' ' + viewBoxSize[1] }">
        ${
          this.lines.map(l => {
            const a = this.normalize(this.vertices[l.a]);
            const b = this.normalize(this.vertices[l.b]);

            return `<line
              x1="${ a[0] }" y1="${ a[1] }"
              x2="${ b[0] }" y2="${ b[1] }"
              stroke="${ l.isOneSided ? '#333' : '#999' }"
              stroke-width="${ l.isOneSided ? 10 : 3 }"/>`}).join('')
        }
      </svg>`
  }
}

export class WadDataView extends DataView {
  constructor(buffer, offset, size) {
    super(buffer, offset, size);
  }

  getASCIIString(offset, length) {
    let result = '';

    for (let i = 0; i < length; i++) {
      let val = this.getUint8(offset + i);

      if (val === 0) {
        return result;
      }
      
      result += String.fromCharCode(val);
    }

    return result;
  }

  setInt16(offset, value) {
    return super.setInt16(offset < 0 ? this.byteLength + offset : offset, value, true);
  }

  getInt16(offset) {
    return super.getInt16(offset < 0 ? this.byteLength + offset : offset, true);
  }

  *packetsOfSize(size) {
    for (let i = 0; i < this.byteLength; i += size) {
      yield new WadDataView(this.buffer, this.byteOffset + i, size);
    }
  }
}

export class Line {
  constructor(data) {
    this.a = data.getInt16(0);
    this.b = data.getInt16(2);
    this.leftSide = data.getInt16(-4);
    this.rightSide = data.getInt16(-2);
    this.isOneSided = this.leftSide == -1 || this.rightSide == -1;
  }
}
