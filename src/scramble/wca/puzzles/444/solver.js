// SPDX-License-Identifier: GPL-3.0-only
//
// 4x4x4 本地随机状态求解器（M3）
//
// 本文件是第三方求解器的离线打包版本，来源为 csTimer（GPLv3）：
//   - isaac.js
//   - min2phase.js
//   - mathlib.js
//   - scramble_333_edit.js
//   - scramble_444.js
// 仅做了模块化 shim、进度回调和导出适配；算法本身未修改。
//
// 许可提醒：csTimer 为 GPLv3。若项目需要闭源分发，请在 M5 许可审计时
// 替换为 clean-room 实现或确认整体许可兼容。

const $ = { now: () => Date.now(), noop() {}, isArray: Array.isArray };
const DEBUG = false;
const image = {};
const scrMgr = (() => {
    const reg = (...args) => reg;
    reg.reg = reg;
    reg.fixCase = () => 0;
    return reg;
})();

function reportStage(stage, percent) {
    if (typeof globalThis.__444_PROGRESS__ === "function") {
        globalThis.__444_PROGRESS__({ phase: "init", stage, percent });
    }
}

/* ----------------------------------------------------------------------
 * Copyright (c) 2012 Yves-Marie K. Rinquin
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * ----------------------------------------------------------------------
 *
 * ISAAC is a cryptographically secure pseudo-random number generator
 * (or CSPRNG for short) designed by Robert J. Jenkins Jr. in 1996 and
 * based on RC4. It is designed for speed and security.
 *
 * ISAAC's informations & analysis:
 *   http://burtleburtle.net/bob/rand/isaac.html
 * ISAAC's implementation details:
 *   http://burtleburtle.net/bob/rand/isaacafa.html
 *
 * ISAAC succesfully passed TestU01
 *
 * ----------------------------------------------------------------------
 *
 * Usage:
 *   <script src="isaac.js"></script>
 *   var random_number = isaac.random();
 *
 * Output: [ 0x00000000; 0xffffffff]
 *         [-2147483648; 2147483647]
 *
 */

/* isaac module pattern */
var isaac = (function(){

	/* private: internal states */
	var m = Array(256), // internal memory
		acc = 0,        // accumulator
		brs = 0,        // last result
		cnt = 0,        // counter
		r = Array(256), // result array
		gnt = 0;        // generation counter

	seed(Math.random() * 0xffffffff);

	/* private: 32-bit integer safe adder */
	function add(x, y) {
		var lsb = (x & 0xffff) + (y & 0xffff);
		var msb = (x >>>   16) + (y >>>   16) + (lsb >>> 16);
		return (msb << 16) | (lsb & 0xffff);
	}

	/* public: initialisation */
	function reset() {
		acc = brs = cnt = 0;
		for(var i = 0; i < 256; ++i)
			m[i] = r[i] = 0;
		gnt = 0;
	}

	/* public: seeding function */
	function seed(s) {
		var a, b, c, d, e, f, g, h, i;

		/* seeding the seeds of love */
		a = b = c = d =
		e = f = g = h = 0x9e3779b9; /* the golden ratio */

		if(s && typeof(s) === 'number') {
			s = [s];
		}

		if(s instanceof Array) {
			reset();
			for(i = 0; i < s.length; i++)
				r[i & 0xff] += (typeof(s[i]) === 'number') ? s[i] : 0;
		}

		/* private: seed mixer */
		function seed_mix() {
			a ^= b <<  11; d = add(d, a); b = add(b, c);
			b ^= c >>>  2; e = add(e, b); c = add(c, d);
			c ^= d <<   8; f = add(f, c); d = add(d, e);
			d ^= e >>> 16; g = add(g, d); e = add(e, f);
			e ^= f <<  10; h = add(h, e); f = add(f, g);
			f ^= g >>>  4; a = add(a, f); g = add(g, h);
			g ^= h <<   8; b = add(b, g); h = add(h, a);
			h ^= a >>>  9; c = add(c, h); a = add(a, b);
		}

		for(i = 0; i < 4; i++) /* scramble it */
			seed_mix();

		for(i = 0; i < 256; i += 8) {
			if(s) { /* use all the information in the seed */
				a = add(a, r[i + 0]); b = add(b, r[i + 1]);
				c = add(c, r[i + 2]); d = add(d, r[i + 3]);
				e = add(e, r[i + 4]); f = add(f, r[i + 5]);
				g = add(g, r[i + 6]); h = add(h, r[i + 7]);
			}
			seed_mix();
			/* fill in m[] with messy stuff */
			m[i + 0] = a; m[i + 1] = b; m[i + 2] = c; m[i + 3] = d;
			m[i + 4] = e; m[i + 5] = f; m[i + 6] = g; m[i + 7] = h;
		}
		if(s) {
			/* do a second pass to make all of the seed affect all of m[] */
			for(i = 0; i < 256; i += 8) {
				a = add(a, m[i + 0]); b = add(b, m[i + 1]);
				c = add(c, m[i + 2]); d = add(d, m[i + 3]);
				e = add(e, m[i + 4]); f = add(f, m[i + 5]);
				g = add(g, m[i + 6]); h = add(h, m[i + 7]);
				seed_mix();
				/* fill in m[] with messy stuff (again) */
				m[i + 0] = a; m[i + 1] = b; m[i + 2] = c; m[i + 3] = d;
				m[i + 4] = e; m[i + 5] = f; m[i + 6] = g; m[i + 7] = h;
			}
		}

		prng(); /* fill in the first set of results */
		gnt = 256;  /* prepare to use the first set of results */;
	}

	/* public: isaac generator, n = number of run */
	function prng(n){
		var i, x, y;

		n = (n && typeof(n) === 'number')
			? Math.abs(Math.floor(n)) : 1;

		while(n--) {
			cnt = add(cnt,   1);
			brs = add(brs, cnt);

			for(i = 0; i < 256; i++) {
				switch(i & 3) {
					case 0: acc ^= acc <<  13; break;
					case 1: acc ^= acc >>>  6; break;
					case 2: acc ^= acc <<   2; break;
					case 3: acc ^= acc >>> 16; break;
				}
				acc        = add(m[(i +  128) & 0xff], acc); x = m[i];
				m[i] =   y = add(m[(x >>>  2) & 0xff], add(acc, brs));
				r[i] = brs = add(m[(y >>> 10) & 0xff], x);
			}
		}
	}

	/* public: return a random number between */
	function rand() {
		if(!gnt--) {
			prng(); gnt = 255;
		}
		return r[gnt];
	}

	function random() {
		return ((rand() >>> 5) * 0x4000000 + (rand() >>> 6)) / 0x20000000000000;
	}

	/* public: return internals in an object*/
	function internals(obj) {
		var ret = {a: acc, b: brs, c: cnt, m: m.slice(), r: r.slice(), g: gnt};
		if (obj) {
			acc = obj.a; brs = obj.b; cnt = obj.c; m = obj.m.slice(); r = obj.r.slice(); gnt = obj.g;
		}
		return ret;
	}

	/* return class object */
	return {
		reset: reset,
		seed:  seed,
		prng:  prng,
		rand:  rand,
		random: random,
		internals: internals
	};
})(); /* declare and execute */

"use strict";

var min2phase = (function() {
	var USE_TWST_FLIP_PRUN = true;
	var PARTIAL_INIT_LEVEL = 2;

	var MAX_PRE_MOVES = 20;
	var TRY_INVERSE = true;
	var TRY_THREE_AXES = true;

	var USE_CONJ_PRUN = USE_TWST_FLIP_PRUN;
	var MIN_P1LENGTH_PRE = 7;
	var MAX_DEPTH2 = 13;

	var INVERSE_SOLUTION = 0x2;

	function Search() {
		this.move = [];
		this.moveSol = [];

		this.nodeUD = [];

		this.valid1 = 0;
		this.allowShorter = false;
		this.cc = new CubieCube();
		this.urfCubieCube = [];
		this.urfCoordCube = [];
		this.phase1Cubie = [];

		this.preMoveCubes = [];
		this.preMoves = [];
		this.preMoveLen = 0;
		this.maxPreMoves = 0;

		this.isRec = false;
		for (var i = 0; i < 21; i++) {
			this.nodeUD[i] = new CoordCube();
			this.phase1Cubie[i] = new CubieCube();
		}
		for (var i = 0; i < 6; i++) {
			this.urfCubieCube[i] = new CubieCube();
			this.urfCoordCube[i] = new CoordCube();
		}
		for (var i = 0; i < MAX_PRE_MOVES; i++) {
			this.preMoveCubes[i + 1] = new CubieCube();
		}
	}

	var Ux1 = 0;
	var Ux2 = 1;
	var Ux3 = 2;
	var Rx1 = 3;
	var Rx2 = 4;
	var Rx3 = 5;
	var Fx1 = 6;
	var Fx2 = 7;
	var Fx3 = 8;
	var Dx1 = 9;
	var Dx2 = 10;
	var Dx3 = 11;
	var Lx1 = 12;
	var Lx2 = 13;
	var Lx3 = 14;
	var Bx1 = 15;
	var Bx2 = 16;
	var Bx3 = 17;

	var N_MOVES = 18;
	var N_MOVES2 = 10;
	var N_FLIP = 2048;
	var N_FLIP_SYM = 336;
	var N_TWST = 2187;
	var N_TWST_SYM = 324;
	var N_PERM = 40320;
	var N_PERM_SYM = 2768;
	var N_MPERM = 24;
	var N_SLICE = 495;
	var N_COMB = 140;

	var SYM_E2C_MAGIC = 0x00DDDD00;
	var Cnk = [];
	var fact = [1];
	var move2str = [
		"U ", "U2", "U'", "R ", "R2", "R'", "F ", "F2", "F'",
		"D ", "D2", "D'", "L ", "L2", "L'", "B ", "B2", "B'"
	];
	var ud2std = [Ux1, Ux2, Ux3, Rx2, Fx2, Dx1, Dx2, Dx3, Lx2, Bx2, Rx1, Rx3, Fx1, Fx3, Lx1, Lx3, Bx1, Bx3];
	var std2ud = [];
	var ckmv2bit = [];
	var urfMove = [
		[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
		[6, 7, 8, 0, 1, 2, 3, 4, 5, 15, 16, 17, 9, 10, 11, 12, 13, 14],
		[3, 4, 5, 6, 7, 8, 0, 1, 2, 12, 13, 14, 15, 16, 17, 9, 10, 11],
		[2, 1, 0, 5, 4, 3, 8, 7, 6, 11, 10, 9, 14, 13, 12, 17, 16, 15],
		[8, 7, 6, 2, 1, 0, 5, 4, 3, 17, 16, 15, 11, 10, 9, 14, 13, 12],
		[5, 4, 3, 8, 7, 6, 2, 1, 0, 14, 13, 12, 17, 16, 15, 11, 10, 9]
	];

	{ // init util
		for (var i = 0; i < 18; i++) {
			std2ud[ud2std[i]] = i;
		}
		for (var i = 0; i < 10; i++) {
			var ix = ~~(ud2std[i] / 3);
			ckmv2bit[i] = 0;
			for (var j = 0; j < 10; j++) {
				var jx = ~~(ud2std[j] / 3);
				ckmv2bit[i] |= ((ix == jx) || ((ix % 3 == jx % 3) && (ix >= jx)) ? 1 : 0) << j;
			}
		}
		ckmv2bit[10] = 0;
		for (var i = 0; i < 13; i++) {
			Cnk[i] = [];
			fact[i + 1] = fact[i] * (i + 1);
			Cnk[i][0] = Cnk[i][i] = 1;
			for (var j = 1; j < 13; j++) {
				Cnk[i][j] = j <= i ? Cnk[i - 1][j - 1] + Cnk[i - 1][j] : 0;
			}
		}
	}

	function setPruning(table, index, value) {
		table[index >> 3] ^= value << (index << 2); // index << 2 <=> (index & 7) << 2
	}

	function getPruning(table, index) {
		return table[index >> 3] >> (index << 2) & 0xf; // index << 2 <=> (index & 7) << 2
	}

	function getPruningMax(maxValue, table, index) {
		return Math.min(maxValue, table[index >> 3] >> (index << 2) & 0xf);
	}

	function hasZero(val) {
		return ((val - 0x11111111) & ~val & 0x88888888) != 0;
	}

	function ESym2CSym(idx) {
		return idx ^ (SYM_E2C_MAGIC >> ((idx & 0xf) << 1) & 3);
	}

	function getPermSymInv(idx, sym, isCorner) {
		var idxi = PermInvEdgeSym[idx];
		if (isCorner) {
			idxi = ESym2CSym(idxi);
		}
		return idxi & 0xfff0 | SymMult[idxi & 0xf][sym];
	}

	function CubieCube() {
		this.ca = [0, 1, 2, 3, 4, 5, 6, 7];
		this.ea = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
	}

	function setNPerm(arr, idx, n) {
		n--;
		var val = 0x76543210;
		for (var i = 0; i < n; ++i) {
			var p = fact[n - i];
			var v = ~~(idx / p);
			idx %= p;
			v <<= 2;
			arr[i] = arr[i] & 0xf0 | val >> v & 0xf;
			var m = (1 << v) - 1;
			val = (val & m) + (val >> 4 & ~m);
		}
		arr[n] = arr[n] & 0xf0 | val & 0xf;
	}

	function getNPerm(arr, n) {
		var idx = 0,
			val = 0x76543210;
		for (var i = 0; i < n - 1; ++i) {
			var v = (arr[i] & 0xf) << 2;
			idx = (n - i) * idx + (val >> v & 0xf);
			val -= 0x11111110 << v;
		}
		return idx;
	}

	function setNPermFull(arr, idx, n) {
		arr[n - 1] = arr[n - 1] & 0xf0;
		for (var i = n - 2; i >= 0; --i) {
			arr[i] = arr[i] & 0xf0 | idx % (n - i);
			idx = ~~(idx / (n - i));
			for (var j = i + 1; j < n; ++j) {
				if ((arr[j] & 0xf) >= (arr[i] & 0xf)) {
					arr[j] += 1;
				}
			}
		}
	}

	function getNPermFull(arr, n) {
		var idx = 0;
		for (var i = 0; i < n; ++i) {
			idx *= n - i;
			for (var j = i + 1; j < n; ++j) {
				if ((arr[j] & 0xf) < (arr[i] & 0xf)) {
					++idx;
				}
			}
		}
		return idx;
	}

	function getComb(arr, mask) {
		var end = arr.length - 1;
		var idxC = 0,
			r = 4;
		for (var i = end; i >= 0; i--) {
			var perm = arr[i] & 0xf;
			if ((perm & 0xc) == mask) {
				idxC += Cnk[i][r--];
			}
		}
		return idxC;
	}

	function setComb(arr, idxC, mask) {
		var end = arr.length - 1;
		var r = 4,
			fill = end;
		for (var i = end; i >= 0; i--) {
			if (idxC >= Cnk[i][r]) {
				idxC -= Cnk[i][r--];
				arr[i] = arr[i] & 0xf0 | r | mask;
			} else {
				if ((fill & 0xc) == mask) {
					fill -= 4;
				}
				arr[i] = arr[i] & 0xf0 | fill--;
			}
		}
	}

	function getNParity(idx, n) {
		var p = 0;
		for (var i = n - 2; i >= 0; i--) {
			p ^= idx % (n - i);
			idx = ~~(idx / (n - i));
		}
		return p & 1;
	}
	CubieCube.EdgeMult = function(a, b, prod) {
		for (var ed = 0; ed < 12; ed++) {
			prod.ea[ed] = a.ea[b.ea[ed] & 0xf] ^ (b.ea[ed] & 0x10);
		}
	}
	CubieCube.CornMult = function(a, b, prod) {
		for (var corn = 0; corn < 8; corn++) {
			var ori = ((a.ca[b.ca[corn] & 0xf] >> 4) + (b.ca[corn] >> 4)) % 3;
			prod.ca[corn] = a.ca[b.ca[corn] & 0xf] & 0xf | ori << 4;
		}
	}
	CubieCube.CornMultFull = function(a, b, prod) {
		for (var corn = 0; corn < 8; corn++) {
			var oriA = a.ca[b.ca[corn] & 0xf] >> 4;
			var oriB = b.ca[corn] >> 4;
			var ori = oriA + ((oriA < 3) ? oriB : 6 - oriB);
			ori = ori % 3 + ((oriA < 3) == (oriB < 3) ? 0 : 3);
			prod.ca[corn] = a.ca[b.ca[corn] & 0xf] & 0xf | ori << 4;
		}
	}
	CubieCube.CornConjugate = function(a, idx, b) {
		var sinv = SymCube[SymMultInv[0][idx]];
		var s = SymCube[idx];
		for (var corn = 0; corn < 8; corn++) {
			var oriA = sinv.ca[a.ca[s.ca[corn] & 0xf] & 0xf] >> 4;
			var oriB = a.ca[s.ca[corn] & 0xf] >> 4;
			var ori = (oriA < 3) ? oriB : (3 - oriB) % 3;
			b.ca[corn] = sinv.ca[a.ca[s.ca[corn] & 0xf] & 0xf] & 0xf | ori << 4;
		}
	}
	CubieCube.EdgeConjugate = function(a, idx, b) {
		var sinv = SymCube[SymMultInv[0][idx]];
		var s = SymCube[idx];
		for (var ed = 0; ed < 12; ed++) {
			b.ea[ed] = sinv.ea[a.ea[s.ea[ed] & 0xf] & 0xf] ^ (a.ea[s.ea[ed] & 0xf] & 0x10) ^ (s.ea[ed] & 0x10);
		}
	}
	CubieCube.prototype.init = function(ca, ea) {
		this.ca = ca.slice();
		this.ea = ea.slice();
		return this;
	}
	CubieCube.prototype.initCoord = function(cperm, twst, eperm, flip) {
		setNPerm(this.ca, cperm, 8);
		this.setTwst(twst);
		setNPermFull(this.ea, eperm, 12);
		this.setFlip(flip);
		return this;
	}
	CubieCube.prototype.isEqual = function(c) {
		for (var i = 0; i < 8; i++) {
			if (this.ca[i] != c.ca[i]) {
				return false;
			}
		}
		for (var i = 0; i < 12; i++) {
			if (this.ea[i] != c.ea[i]) {
				return false;
			}
		}
		return true;
	}
	CubieCube.prototype.setFlip = function(idx) {
		var parity = 0;
		for (var i = 10; i >= 0; i--, idx >>= 1) {
			this.ea[i] = this.ea[i] & 0xf | (idx & 1) << 4;
			parity ^= this.ea[i];
		}
		this.ea[11] = this.ea[11] & 0xf | parity & 0x10;
	}
	CubieCube.prototype.getFlip = function() {
		var idx = 0;
		for (var i = 0; i < 11; i++) {
			idx = idx << 1 | this.ea[i] >> 4 & 1;
		}
		return idx;
	}
	CubieCube.prototype.getFlipSym = function() {
		return FlipR2S[this.getFlip()];
	}
	CubieCube.prototype.setTwst = function(idx) {
		var twst = 15;
		for (var i = 6; i >= 0; i--, idx = ~~(idx / 3)) {
			this.ca[i] = this.ca[i] & 0xf | idx % 3 << 4;
			twst -= this.ca[i] >> 4;
		}
		this.ca[7] = this.ca[7] & 0xf | (twst % 3) << 4;
	}
	CubieCube.prototype.getTwst = function() {
		var idx = 0;
		for (var i = 0; i < 7; i++) {
			idx += (idx << 1) + (this.ca[i] >> 4);
		}
		return idx;
	}
	CubieCube.prototype.getTwstSym = function() {
		return TwstR2S[this.getTwst()];
	}
	CubieCube.prototype.setCPerm = function(idx) {
		setNPerm(this.ca, idx, 8);
	}
	CubieCube.prototype.getCPerm = function() {
		return getNPerm(this.ca, 8);
	}
	CubieCube.prototype.getCPermSym = function() {
		return ESym2CSym(EPermR2S[getNPerm(this.ca, 8)]);
	}
	CubieCube.prototype.setEPerm = function(idx) {
		setNPerm(this.ea, idx, 8);
	}
	CubieCube.prototype.getEPerm = function() {
		return getNPerm(this.ea, 8);
	}
	CubieCube.prototype.getEPermSym = function() {
		return EPermR2S[getNPerm(this.ea, 8)];
	}
	CubieCube.prototype.getSlice = function() {
		return 494 - getComb(this.ea, 8);
	}
	CubieCube.prototype.setSlice = function(idx) {
		setComb(this.ea, 494 - idx, 8);
	}
	CubieCube.prototype.getMPerm = function() {
		return getNPermFull(this.ea, 12) % 24;
	}
	CubieCube.prototype.setMPerm = function(idx) {
		setNPermFull(this.ea, idx, 12);
	}
	CubieCube.prototype.getCComb = function() {
		return getComb(this.ca, 0);
	}
	CubieCube.prototype.setCComb = function(idx) {
		setComb(this.ca, idx, 0);
	}
	CubieCube.prototype.URFConjugate = function() {
		var temps = new CubieCube();
		CubieCube.CornMult(CubieCube.urf2, this, temps);
		CubieCube.CornMult(temps, CubieCube.urf1, this);
		CubieCube.EdgeMult(CubieCube.urf2, this, temps);
		CubieCube.EdgeMult(temps, CubieCube.urf1, this);
	}
	var cornerFacelet = [
		[8, 9, 20],
		[6, 18, 38],
		[0, 36, 47],
		[2, 45, 11],
		[29, 26, 15],
		[27, 44, 24],
		[33, 53, 42],
		[35, 17, 51]
	];
	var edgeFacelet = [
		[5, 10],
		[7, 19],
		[3, 37],
		[1, 46],
		[32, 16],
		[28, 25],
		[30, 43],
		[34, 52],
		[23, 12],
		[21, 41],
		[50, 39],
		[48, 14]
	];
	CubieCube.prototype.toFaceCube = function(cFacelet, eFacelet) {
		cFacelet = cFacelet || cornerFacelet;
		eFacelet = eFacelet || edgeFacelet;
		var ts = "URFDLB";
		var f = [];
		for (var i = 0; i < 54; i++) {
			f[i] = ts[~~(i / 9)];
		}
		for (var c = 0; c < 8; c++) {
			var j = this.ca[c] & 0xf; // cornercubie with index j is at
			var ori = this.ca[c] >> 4; // Orientation of this cubie
			for (var n = 0; n < 3; n++)
				f[cFacelet[c][(n + ori) % 3]] = ts[~~(cFacelet[j][n] / 9)];
		}
		for (var e = 0; e < 12; e++) {
			var j = this.ea[e] & 0xf; // edgecubie with index j is at edgeposition
			var ori = this.ea[e] >> 4; // Orientation of this cubie
			for (var n = 0; n < 2; n++)
				f[eFacelet[e][(n + ori) % 2]] = ts[~~(eFacelet[j][n] / 9)];
		}
		return f.join("");
	}
	CubieCube.prototype.invFrom = function(cc) {
		for (var edge = 0; edge < 12; edge++) {
			this.ea[cc.ea[edge] & 0xf] = edge & 0xf | cc.ea[edge] & 0x10;
		}
		for (var corn = 0; corn < 8; corn++) {
			this.ca[cc.ca[corn] & 0xf] = corn | 0x40 >> (cc.ca[corn] >> 4) & 0x30;
		}
		return this;
	}
	CubieCube.prototype.fromFacelet = function(facelet, cFacelet, eFacelet) {
		cFacelet = cFacelet || cornerFacelet;
		eFacelet = eFacelet || edgeFacelet;
		var count = 0;
		var f = [];
		var centers = facelet[4] + facelet[13] + facelet[22] + facelet[31] + facelet[40] + facelet[49];
		for (var i = 0; i < 54; ++i) {
			f[i] = centers.indexOf(facelet[i]);
			if (f[i] == -1) {
				return -1;
			}
			count += 1 << (f[i] << 2);
		}
		if (count != 0x999999) {
			return -1;
		}
		var col1, col2, i, j, ori;
		for (i = 0; i < 8; ++i) {
			for (ori = 0; ori < 3; ++ori)
				if (f[cFacelet[i][ori]] == 0 || f[cFacelet[i][ori]] == 3)
					break;
			col1 = f[cFacelet[i][(ori + 1) % 3]];
			col2 = f[cFacelet[i][(ori + 2) % 3]];
			for (j = 0; j < 8; ++j) {
				if (col1 == ~~(cFacelet[j][1] / 9) && col2 == ~~(cFacelet[j][2] / 9)) {
					this.ca[i] = j | ori % 3 << 4;
					break;
				}
			}
		}
		for (i = 0; i < 12; ++i) {
			for (j = 0; j < 12; ++j) {
				if (f[eFacelet[i][0]] == ~~(eFacelet[j][0] / 9) && f[eFacelet[i][1]] == ~~(eFacelet[j][1] / 9)) {
					this.ea[i] = j;
					break;
				}
				if (f[eFacelet[i][0]] == ~~(eFacelet[j][1] / 9) && f[eFacelet[i][1]] == ~~(eFacelet[j][0] / 9)) {
					this.ea[i] = j | 0x10;
					break;
				}
			}
		}
	}

	function CoordCube() {
		this.twst = 0;
		this.flip = 0;
		this.slice = 0;
		this.prun = 0;
		this.twstc = 0;
		this.flipc = 0;
	}
	CoordCube.prototype.set = function(node) {
		this.twst = node.twst;
		this.flip = node.flip;
		this.slice = node.slice;
		this.prun = node.prun;
		if (USE_CONJ_PRUN) {
			this.twstc = node.twstc;
			this.flipc = node.flipc;
		}
	}
	CoordCube.prototype.calcPruning = function(isPhase1) {
		this.prun = Math.max(
			getPruningMax(SliceTwstPrunMax, SliceTwstPrun,
				(this.twst >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.twst & 7]),
			getPruningMax(SliceFlipPrunMax, SliceFlipPrun,
				(this.flip >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.flip & 7]),
			USE_CONJ_PRUN ? getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
				(this.twstc >> 3) << 11 | FlipS2RF[this.flipc ^ (this.twstc & 7)]) : 0,
			USE_TWST_FLIP_PRUN ? getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
				(this.twst >> 3) << 11 | FlipS2RF[this.flip ^ (this.twst & 7)]) : 0
		);
	}
	CoordCube.prototype.setWithPrun = function(cc, depth) {
		this.twst = cc.getTwstSym();
		this.flip = cc.getFlipSym();
		this.prun = USE_TWST_FLIP_PRUN ? getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
			(this.twst >> 3) << 11 | FlipS2RF[this.flip ^ (this.twst & 7)]) : 0;
		if (this.prun > depth) {
			return false;
		}
		this.slice = cc.getSlice();
		this.prun = Math.max(this.prun,
			getPruningMax(SliceTwstPrunMax, SliceTwstPrun,
				(this.twst >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.twst & 7]),
			getPruningMax(SliceFlipPrunMax, SliceFlipPrun,
				(this.flip >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.flip & 7]));
		if (this.prun > depth) {
			return false;
		}
		if (USE_CONJ_PRUN) {
			var pc = new CubieCube();
			CubieCube.CornConjugate(cc, 1, pc);
			CubieCube.EdgeConjugate(cc, 1, pc);
			this.twstc = pc.getTwstSym();
			this.flipc = pc.getFlipSym();
			this.prun = Math.max(this.prun,
				getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
					(this.twstc >> 3) << 11 | FlipS2RF[this.flipc ^ (this.twstc & 7)]));
		}
		return this.prun <= depth;
	}
	CoordCube.prototype.doMovePrun = function(cc, m, isPhase1) {
		this.slice = SliceMove[cc.slice * N_MOVES + m];
		this.flip = FlipMove[(cc.flip >> 3) * N_MOVES + Sym8Move[m << 3 | cc.flip & 7]] ^ (cc.flip & 7);
		this.twst = TwstMove[(cc.twst >> 3) * N_MOVES + Sym8Move[m << 3 | cc.twst & 7]] ^ (cc.twst & 7);
		this.prun = Math.max(
			getPruningMax(SliceTwstPrunMax, SliceTwstPrun,
				(this.twst >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.twst & 7]),
			getPruningMax(SliceFlipPrunMax, SliceFlipPrun,
				(this.flip >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.flip & 7]),
			USE_TWST_FLIP_PRUN ? getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
				(this.twst >> 3) << 11 | FlipS2RF[this.flip ^ (this.twst & 7)]) : 0);
		return this.prun;
	}
	CoordCube.prototype.doMovePrunConj = function(cc, m) {
		m = SymMove[3][m];
		this.flipc = FlipMove[(cc.flipc >> 3) * N_MOVES + Sym8Move[m << 3 | cc.flipc & 7]] ^ (cc.flipc & 7);
		this.twstc = TwstMove[(cc.twstc >> 3) * N_MOVES + Sym8Move[m << 3 | cc.twstc & 7]] ^ (cc.twstc & 7);
		return getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
			(this.twstc >> 3) << 11 | FlipS2RF[this.flipc ^ (this.twstc & 7)]);
	}
	Search.prototype.solution = function(facelets, maxDepth, probeMax, probeMin, verbose, firstAxisFilter, lastAxisFilter) {
		initPrunTables();
		var check = this.verify(facelets);
		if (check != 0) {
			return "Error " + Math.abs(check);
		}
		if (maxDepth === undefined) {
			maxDepth = 21;
		}
		if (probeMax === undefined) {
			probeMax = 1e9;
		}
		if (probeMin === undefined) {
			probeMin = 0;
		}
		if (verbose === undefined) {
			verbose = 0;
		}
		this.sol = maxDepth + 1;
		this.probe = 0;
		this.probeMax = probeMax;
		this.probeMin = Math.min(probeMin, probeMax);
		this.verbose = verbose;
		this.moveSol = null;
		this.isRec = false;
		this.firstFilters = [0, 0, 0, 0, 0, 0];
		this.lastFilters = [0, 0, 0, 0, 0, 0];
		for (var i = 0; i < 3; i++) {
			if (firstAxisFilter !== undefined) {
				this.firstFilters[i] |= 0xe07 << (~~(urfMove[(3 - i) % 3][firstAxisFilter * 3] / 3)) * 3;
				this.lastFilters[i + 3] |= 0xe07 << (~~(urfMove[(3 - i) % 3][firstAxisFilter * 3] / 3)) * 3;
			}
			if (lastAxisFilter !== undefined) {
				this.lastFilters[i] |= 0xe07 << (~~(urfMove[(3 - i) % 3][lastAxisFilter * 3] / 3)) * 3;
				this.firstFilters[i + 3] |= 0xe07 << (~~(urfMove[(3 - i) % 3][lastAxisFilter * 3] / 3)) * 3;
			}
		}
		this.initSearch();
		return this.search();
	}

	Search.prototype.initSearch = function() {
		this.conjMask = (TRY_INVERSE ? 0 : 0x38) | (TRY_THREE_AXES ? 0 : 0x36);
		this.maxPreMoves = this.conjMask > 7 ? 0 : MAX_PRE_MOVES;

		for (var i = 0; i < 6; i++) {
			this.urfCubieCube[i].init(this.cc.ca, this.cc.ea);
			this.urfCoordCube[i].setWithPrun(this.urfCubieCube[i], 20);
			this.cc.URFConjugate();
			if (i % 3 == 2) {
				var tmp = new CubieCube().invFrom(this.cc);
				this.cc.init(tmp.ca, tmp.ea);
			}
		}
	}

	Search.prototype.next = function(probeMax, probeMin, verbose) {
		this.probe = 0;
		this.probeMax = probeMax;
		this.probeMin = Math.min(probeMin, probeMax);
		this.moveSol = null;
		this.isRec = true;
		this.verbose = verbose;
		return this.search();
	}

	Search.prototype.verify = function(facelets) {
		if (this.cc.fromFacelet(facelets) == -1) {
			return -1;
		}
		var sum = 0;
		var edgeMask = 0;
		for (var e = 0; e < 12; e++) {
			edgeMask |= 1 << (this.cc.ea[e] & 0xf);
			sum ^= this.cc.ea[e] >> 4;
		}
		if (edgeMask != 0xfff) {
			return -2; // missing edges
		}
		if (sum != 0) {
			return -3;
		}
		var cornMask = 0;
		sum = 0;
		for (var c = 0; c < 8; c++) {
			cornMask |= 1 << (this.cc.ca[c] & 0xf);
			sum += this.cc.ca[c] >> 4;
		}
		if (cornMask != 0xff) {
			return -4; // missing corners
		}
		if (sum % 3 != 0) {
			return -5; // twisted corner
		}
		if ((getNParity(getNPermFull(this.cc.ea, 12), 12) ^ getNParity(this.cc.getCPerm(), 8)) != 0) {
			return -6; // parity error
		}
		return 0; // cube ok
	}

	Search.prototype.phase1PreMoves = function(maxl, lm, cc) {
		if (maxl == this.maxPreMoves - 1 && (this.lastFilter >> lm & 1) != 0) {
			return 1;
		}
		this.preMoveLen = this.maxPreMoves - maxl;
		if (this.isRec ? (this.depth1 == this.length1 - this.preMoveLen) :
			(this.preMoveLen == 0 || (0x36FB7 >> lm & 1) == 0)) {
			this.depth1 = this.length1 - this.preMoveLen;
			this.phase1Cubie[0].init(cc.ca, cc.ea) /* = cc*/ ;
			this.allowShorter = this.depth1 == MIN_P1LENGTH_PRE && this.preMoveLen != 0;

			if (this.nodeUD[this.depth1 + 1].setWithPrun(cc, this.depth1) &&
				this.phase1(this.nodeUD[this.depth1 + 1], this.depth1, -1) == 0) {
				return 0;
			}
		}

		if (maxl == 0 || this.preMoveLen + MIN_P1LENGTH_PRE >= this.length1) {
			return 1;
		}

		var skipMoves = 0;
		if (maxl == 1 || this.preMoveLen + 1 + MIN_P1LENGTH_PRE >= this.length1) { //last pre move
			skipMoves |= 0x36FB7; // 11 0110 1111 1011 0111
		}

		lm = ~~(lm / 3) * 3;
		for (var m = 0; m < 18; m++) {
			if (m == lm || m == lm - 9 || m == lm + 9) {
				m += 2;
				continue;
			}
			if (this.isRec && m != this.preMoves[this.maxPreMoves - maxl] || (skipMoves & 1 << m) != 0) {
				continue;
			}
			CubieCube.CornMult(moveCube[m], cc, this.preMoveCubes[maxl]);
			CubieCube.EdgeMult(moveCube[m], cc, this.preMoveCubes[maxl]);
			this.preMoves[this.maxPreMoves - maxl] = m;
			var ret = this.phase1PreMoves(maxl - 1, m, this.preMoveCubes[maxl]);
			if (ret == 0) {
				return 0;
			}
		}
		return 1;
	}

	Search.prototype.search = function() {
		for (this.length1 = this.isRec ? this.length1 : 0; this.length1 < this.sol; this.length1++) {
			for (this.urfIdx = this.isRec ? this.urfIdx : 0; this.urfIdx < 6; this.urfIdx++) {
				if ((this.conjMask & 1 << this.urfIdx) != 0) {
					continue;
				}
				this.firstFilter = this.firstFilters[this.urfIdx];
				this.lastFilter = this.lastFilters[this.urfIdx];
				if (this.phase1PreMoves(this.maxPreMoves, -30, this.urfCubieCube[this.urfIdx], 0) == 0) {
					return this.moveSol == null ? "Error 8" : this.moveSol;
				}
			}
		}
		return this.moveSol == null ? "Error 7" : this.moveSol;
	}

	Search.prototype.initPhase2Pre = function() {
		this.isRec = false;
		if (this.probe >= (this.moveSol == null ? this.probeMax : this.probeMin)) {
			return 0;
		}
		++this.probe;

		for (var i = this.valid1; i < this.depth1; i++) {
			CubieCube.CornMult(this.phase1Cubie[i], moveCube[this.move[i]], this.phase1Cubie[i + 1]);
			CubieCube.EdgeMult(this.phase1Cubie[i], moveCube[this.move[i]], this.phase1Cubie[i + 1]);
		}
		this.valid1 = this.depth1;

		var ret = this.initPhase2(this.phase1Cubie[this.depth1]);
		if (ret == 0 || this.preMoveLen == 0 || ret == 2) {
			return ret;
		}

		var m = ~~(this.preMoves[this.preMoveLen - 1] / 3) * 3 + 1;
		CubieCube.CornMult(moveCube[m], this.phase1Cubie[this.depth1], this.phase1Cubie[this.depth1 + 1]);
		CubieCube.EdgeMult(moveCube[m], this.phase1Cubie[this.depth1], this.phase1Cubie[this.depth1 + 1]);

		this.preMoves[this.preMoveLen - 1] += 2 - this.preMoves[this.preMoveLen - 1] % 3 * 2;
		ret = this.initPhase2(this.phase1Cubie[this.depth1 + 1]);
		this.preMoves[this.preMoveLen - 1] += 2 - this.preMoves[this.preMoveLen - 1] % 3 * 2;
		return ret;
	}
	Search.prototype.initPhase2 = function(phase2Cubie) {
		var p2corn = phase2Cubie.getCPermSym();
		var p2csym = p2corn & 0xf;
		p2corn >>= 4;
		var p2edge = phase2Cubie.getEPermSym();
		var p2esym = p2edge & 0xf;
		p2edge >>= 4;
		var p2mid = phase2Cubie.getMPerm();
		var prun = Math.max(
			getPruningMax(EPermCCombPPrunMax, EPermCCombPPrun,
				p2edge * N_COMB + CCombPConj[(Perm2CombP[p2corn] & 0xff) << 4 | SymMultInv[p2esym][p2csym]]),
			getPruningMax(MCPermPrunMax, MCPermPrun,
				p2corn * N_MPERM + MPermConj[p2mid << 4 | p2csym]));
		var maxDep2 = Math.min(MAX_DEPTH2, this.sol - this.length1);
		if (prun >= maxDep2) {
			return prun > maxDep2 ? 2 : 1;
		}
		var depth2;
		for (depth2 = maxDep2 - 1; depth2 >= prun; depth2--) {
			var ret = this.phase2(p2edge, p2esym, p2corn, p2csym, p2mid, depth2, this.depth1, 10);
			if (ret < 0) {
				break;
			}
			depth2 -= ret;
			this.moveSol = [];
			for (var i = 0; i < this.depth1 + depth2; i++) {
				this.appendSolMove(this.move[i]);
			}
			for (var i = this.preMoveLen - 1; i >= 0; i--) {
				this.appendSolMove(this.preMoves[i]);
			}
			this.sol = this.moveSol.length;
			this.moveSol = this.solutionToString();
		}
		if (depth2 != maxDep2 - 1) { //At least one solution has been found.
			return this.probe >= this.probeMin ? 0 : 1;
		} else {
			return 1;
		}
	}
	Search.prototype.phase1 = function(node, maxl, lm) {
		if (maxl == this.depth1 - 1 && (this.firstFilter >> lm & 1) != 0) {
			return 1;
		}
		if (node.prun == 0 && maxl < 5) {
			if (this.allowShorter || maxl == 0) {
				this.depth1 -= maxl;
				var ret = this.initPhase2Pre();
				this.depth1 += maxl;
				return ret;
			} else {
				return 1;
			}
		}
		for (var axis = 0; axis < 18; axis += 3) {
			if (axis == lm || axis == lm - 9) {
				continue;
			}
			for (var power = 0; power < 3; power++) {
				var m = axis + power;

				if (this.isRec && m != this.move[this.depth1 - maxl]) {
					continue;
				}

				var prun = this.nodeUD[maxl].doMovePrun(node, m, true);
				if (prun > maxl) {
					break;
				} else if (prun == maxl) {
					continue;
				}

				if (USE_CONJ_PRUN) {
					prun = this.nodeUD[maxl].doMovePrunConj(node, m);
					if (prun > maxl) {
						break;
					} else if (prun == maxl) {
						continue;
					}
				}
				this.move[this.depth1 - maxl] = m;
				this.valid1 = Math.min(this.valid1, this.depth1 - maxl);
				var ret = this.phase1(this.nodeUD[maxl], maxl - 1, axis);
				if (ret == 0) {
					return 0;
				} else if (ret == 2) {
					break;
				}
			}
		}
		return 1;
	}
	Search.prototype.appendSolMove = function(curMove) {
		if (this.moveSol.length == 0) {
			this.moveSol.push(curMove);
			return;
		}
		var axisCur = ~~(curMove / 3);
		var axisLast = ~~(this.moveSol.at(-1) / 3);
		if (axisCur == axisLast) {
			var pow = (curMove % 3 + this.moveSol.at(-1) % 3 + 1) % 4;
			if (pow == 3) {
				this.moveSol.pop();
			} else {
				this.moveSol.splice(-1, 1, axisCur * 3 + pow);
			}
			return;
		}
		if (this.moveSol.length > 1 &&
			axisCur % 3 == axisLast % 3 &&
			axisCur == ~~(this.moveSol.at(-2) / 3)) {
			var pow = (curMove % 3 + this.moveSol.at(-2) % 3 + 1) % 4;
			if (pow == 3) {
				this.moveSol.splice(-2, 1, this.moveSol.at(-1));
				this.moveSol.pop();
			} else {
				this.moveSol.splice(-2, 1, axisCur * 3 + pow);
			}
			return;
		}
		this.moveSol.push(curMove);
	}
	Search.prototype.phase2 = function(edge, esym, corn, csym, mid, maxl, depth, lm) {
		if (this.depth1 == 0 && depth == 1 && (this.firstFilter >> ud2std[lm] & 1) != 0) {
			return -1;
		}
		if (edge == 0 && corn == 0 && mid == 0 && (this.preMoveLen > 0 || (this.lastFilter >> ud2std[lm] & 1) == 0)) {
			return maxl;
		}
		var moveMask = ckmv2bit[lm];
		for (var m = 0; m < 10; m++) {
			if ((moveMask >> m & 1) != 0) {
				m += 0x42 >> m & 3;
				continue;
			}
			var midx = MPermMove[mid * N_MOVES2 + m];
			var cornx = CPermMove[corn * N_MOVES2 + SymMoveUD[csym][m]];
			var csymx = SymMult[cornx & 0xf][csym];
			cornx >>= 4;
			if (getPruningMax(MCPermPrunMax, MCPermPrun,
					cornx * N_MPERM + MPermConj[midx << 4 | csymx]) >= maxl) {
				continue;
			}
			var edgex = EPermMove[edge * N_MOVES2 + SymMoveUD[esym][m]];
			var esymx = SymMult[edgex & 0xf][esym];
			edgex >>= 4;
			if (getPruningMax(EPermCCombPPrunMax, EPermCCombPPrun,
					edgex * N_COMB + CCombPConj[(Perm2CombP[cornx] & 0xff) << 4 | SymMultInv[esymx][csymx]]) >= maxl) {
				continue;
			}
			var edgei = getPermSymInv(edgex, esymx, false);
			var corni = getPermSymInv(cornx, csymx, true);
			if (getPruningMax(EPermCCombPPrunMax, EPermCCombPPrun,
					(edgei >> 4) * N_COMB + CCombPConj[(Perm2CombP[corni >> 4] & 0xff) << 4 | SymMultInv[edgei & 0xf][corni & 0xf]]) >= maxl) {
				continue;
			}

			var ret = this.phase2(edgex, esymx, cornx, csymx, midx, maxl - 1, depth + 1, m);
			if (ret >= 0) {
				this.move[depth] = ud2std[m];
				return ret;
			}
		}
		return -1;
	}
	Search.prototype.solutionToString = function() {
		var sb = '';
		var urf = (this.verbose & INVERSE_SOLUTION) != 0 ? (this.urfIdx + 3) % 6 : this.urfIdx;
		if (urf < 3) {
			for (var s = 0; s < this.moveSol.length; ++s) {
				sb += move2str[urfMove[urf][this.moveSol[s]]] + ' ';
			}
		} else {
			for (var s = this.moveSol.length - 1; s >= 0; --s) {
				sb += move2str[urfMove[urf][this.moveSol[s]]] + ' ';
			}
		}
		return sb;
	}

	var moveCube = [];
	var SymCube = [];
	var SymMult = [];
	var SymMultInv = [];
	var SymMove = [];
	var SymMoveUD = [];
	var Sym8Move = [];
	var FlipS2R = [];
	var FlipR2S = [];
	var FlipSelfSym = [];
	var FlipS2RF = [];
	var TwstS2R = [];
	var TwstR2S = [];
	var TwstSelfSym = [];
	var EPermS2R = [];
	var EPermR2S = [];
	var PermSelfSym = [];
	var Perm2CombP = [];
	var PermInvEdgeSym = [];
	var TwstMove = [];
	var FlipMove = [];
	var SliceMove = [];
	var SliceConj = [];
	var SliceTwstPrun = [];
	var SliceFlipPrun = [];
	var TwstFlipPrun = [];

	//phase2
	var CPermMove = [];
	var EPermMove = [];
	var MPermMove = [];
	var MPermConj = [];
	var CCombPMove = [];
	var CCombPConj = [];
	var MCPermPrun = [];
	var EPermCCombPPrun = [];

	var TwstFlipPrunMax = 15;
	var SliceTwstPrunMax = 15;
	var SliceFlipPrunMax = 15;
	var MCPermPrunMax = 15;
	var EPermCCombPPrunMax = 15;

	{ //init move cubes
		for (var i = 0; i < 18; i++) {
			moveCube[i] = new CubieCube()
		}
		moveCube[0].initCoord(15120, 0, 119750400, 0);
		moveCube[3].initCoord(21021, 1494, 323403417, 0);
		moveCube[6].initCoord(8064, 1236, 29441808, 550);
		moveCube[9].initCoord(9, 0, 5880, 0);
		moveCube[12].initCoord(1230, 412, 2949660, 0);
		moveCube[15].initCoord(224, 137, 328552, 137);
		for (var a = 0; a < 18; a += 3) {
			for (var p = 0; p < 2; p++) {
				CubieCube.EdgeMult(moveCube[a + p], moveCube[a], moveCube[a + p + 1]);
				CubieCube.CornMult(moveCube[a + p], moveCube[a], moveCube[a + p + 1]);
			}
		}
		CubieCube.urf1 = new CubieCube().initCoord(2531, 1373, 67026819, 1367);
		CubieCube.urf2 = new CubieCube().initCoord(2089, 1906, 322752913, 2040);
	}

	function initBasic() {
		//init sym cubes
		var c = new CubieCube();
		var d = new CubieCube();
		var t;

		var f2 = new CubieCube().initCoord(28783, 0, 259268407, 0);
		var u4 = new CubieCube().initCoord(15138, 0, 119765538, 7);
		var lr2 = new CubieCube().initCoord(5167, 0, 83473207, 0);
		for (var i = 0; i < 8; i++) {
			lr2.ca[i] |= 3 << 4;
		}
		for (var i = 0; i < 16; i++) {
			SymCube[i] = new CubieCube().init(c.ca, c.ea);
			CubieCube.CornMultFull(c, u4, d);
			CubieCube.EdgeMult(c, u4, d);
			c.init(d.ca, d.ea);
			if (i % 4 == 3) {
				CubieCube.CornMultFull(c, lr2, d);
				CubieCube.EdgeMult(c, lr2, d);
				c.init(d.ca, d.ea);
			}
			if (i % 8 == 7) {
				CubieCube.CornMultFull(c, f2, d);
				CubieCube.EdgeMult(c, f2, d);
				c.init(d.ca, d.ea);
			}
		}

		// gen sym tables
		for (var i = 0; i < 16; i++) {
			SymMult[i] = [];
			SymMultInv[i] = [];
			SymMove[i] = [];
			Sym8Move[i] = [];
			SymMoveUD[i] = [];
		}
		for (var i = 0; i < 16; i++) {
			for (var j = 0; j < 16; j++) {
				SymMult[i][j] = i ^ j ^ (0x14ab4 >> j & i << 1 & 2); // SymMult[i][j] = (i ^ j ^ (0x14ab4 >> j & i << 1 & 2)));
				SymMultInv[SymMult[i][j]][j] = i;
			}
		}

		c = new CubieCube();
		for (var s = 0; s < 16; s++) {
			for (var j = 0; j < 18; j++) {
				CubieCube.CornConjugate(moveCube[j], SymMultInv[0][s], c);
				outloop: for (var m = 0; m < 18; m++) {
					for (var k = 0; k < 8; k++) {
						if (moveCube[m].ca[k] != c.ca[k]) {
							continue outloop;
						}
					}
					SymMove[s][j] = m;
					SymMoveUD[s][std2ud[j]] = std2ud[m];
					break;
				}
				if (s % 2 == 0) {
					Sym8Move[j << 3 | s >> 1] = SymMove[s][j];
				}
			}
		}

		// init sym 2 raw tables
		function initSym2Raw(N_RAW, Sym2Raw, Raw2Sym, SelfSym, coord, setFunc, getFunc) {
			var N_RAW_HALF = (N_RAW + 1) >> 1;
			var c = new CubieCube();
			var d = new CubieCube();
			var count = 0;
			var sym_inc = coord >= 2 ? 1 : 2;
			var conjFunc = coord != 1 ? CubieCube.EdgeConjugate : CubieCube.CornConjugate;

			for (var i = 0; i < N_RAW; i++) {
				if (Raw2Sym[i] !== undefined) {
					continue;
				}
				setFunc.call(c, i);
				for (var s = 0; s < 16; s += sym_inc) {
					conjFunc(c, s, d);
					var idx = getFunc.call(d);
					if (USE_TWST_FLIP_PRUN && coord == 0) {
						FlipS2RF[count << 3 | s >> 1] = idx;
					}
					if (idx == i) {
						SelfSym[count] |= 1 << (s / sym_inc);
					}
					Raw2Sym[idx] = (count << 4 | s) / sym_inc;
				}
				Sym2Raw[count++] = i;
			}
			return count;
		}

		initSym2Raw(N_FLIP, FlipS2R, FlipR2S, FlipSelfSym, 0, CubieCube.prototype.setFlip, CubieCube.prototype.getFlip);
		initSym2Raw(N_TWST, TwstS2R, TwstR2S, TwstSelfSym, 1, CubieCube.prototype.setTwst, CubieCube.prototype.getTwst);
		initSym2Raw(N_PERM, EPermS2R, EPermR2S, PermSelfSym, 2, CubieCube.prototype.setEPerm, CubieCube.prototype.getEPerm);

		var cc = new CubieCube();
		for (var i = 0; i < N_PERM_SYM; i++) {
			setNPerm(cc.ea, EPermS2R[i], 8);
			Perm2CombP[i] = getComb(cc.ea, 0) + getNParity(EPermS2R[i], 8) * 70;
			c.invFrom(cc);
			PermInvEdgeSym[i] = EPermR2S[c.getEPerm()];
		}

		// init coord tables
		c = new CubieCube();
		d = new CubieCube();
		function initSymMoveTable(moveTable, SymS2R, N_SIZE, N_MOVES, setFunc, getFunc, multFunc, ud2std) {
			for (var i = 0; i < N_SIZE; i++) {
				setFunc.call(c, SymS2R[i]);
				for (var j = 0; j < N_MOVES; j++) {
					multFunc(c, moveCube[ud2std ? ud2std[j] : j], d);
					moveTable[i * N_MOVES + j] = getFunc.call(d);
				}
			}
		}

		initSymMoveTable(FlipMove, FlipS2R, N_FLIP_SYM, N_MOVES,
			CubieCube.prototype.setFlip, CubieCube.prototype.getFlipSym, CubieCube.EdgeMult);
		initSymMoveTable(TwstMove, TwstS2R, N_TWST_SYM, N_MOVES,
			CubieCube.prototype.setTwst, CubieCube.prototype.getTwstSym, CubieCube.CornMult);
		initSymMoveTable(EPermMove, EPermS2R, N_PERM_SYM, N_MOVES2,
			CubieCube.prototype.setEPerm, CubieCube.prototype.getEPermSym, CubieCube.EdgeMult, ud2std);
		initSymMoveTable(CPermMove, EPermS2R, N_PERM_SYM, N_MOVES2,
			CubieCube.prototype.setCPerm, CubieCube.prototype.getCPermSym, CubieCube.CornMult, ud2std);

		for (var i = 0; i < N_SLICE; i++) {
			c.setSlice(i);
			for (var j = 0; j < N_MOVES; j++) {
				CubieCube.EdgeMult(c, moveCube[j], d);
				SliceMove[i * N_MOVES + j] = d.getSlice();
			}
			for (var j = 0; j < 16; j += 2) {
				CubieCube.EdgeConjugate(c, SymMultInv[0][j], d);
				SliceConj[i << 3 | j >> 1] = d.getSlice();
			}
		}

		for (var i = 0; i < N_MPERM; i++) {
			c.setMPerm(i);
			for (var j = 0; j < N_MOVES2; j++) {
				CubieCube.EdgeMult(c, moveCube[ud2std[j]], d);
				MPermMove[i * N_MOVES2 + j] = d.getMPerm();
			}
			for (var j = 0; j < 16; j++) {
				CubieCube.EdgeConjugate(c, SymMultInv[0][j], d);
				MPermConj[i << 4 | j] = d.getMPerm();
			}
		}

		for (var i = 0; i < N_COMB; i++) {
			c.setCComb(i % 70);
			for (var j = 0; j < N_MOVES2; j++) {
				CubieCube.CornMult(c, moveCube[ud2std[j]], d);
				CCombPMove[i * N_MOVES2 + j] = d.getCComb() + 70 * ((0xA5 >> j & 1) ^ ~~(i / 70));
			}
			for (var j = 0; j < 16; j++) {
				CubieCube.CornConjugate(c, SymMultInv[0][j], d);
				CCombPConj[i << 4 | j] = d.getCComb() + 70 * ~~(i / 70);
			}
		}
	}

	//init pruning tables
	var InitPrunProgress = -1;

	function initRawSymPrun(PrunTable, N_RAW, N_SYM, RawMove, RawConj, SymMove, SelfSym, PrunFlag) {
		var SYM_SHIFT = PrunFlag & 0xf;
		var SYM_E2C_MAGIC = ((PrunFlag >> 4) & 1) == 1 ? 0x00DDDD00 : 0x00000000;
		var IS_PHASE2 = ((PrunFlag >> 5) & 1) == 1;
		var INV_DEPTH = PrunFlag >> 8 & 0xf;
		var MAX_DEPTH = PrunFlag >> 12 & 0xf;
		var MIN_DEPTH = PrunFlag >> 16 & 0xf;

		var SYM_MASK = (1 << SYM_SHIFT) - 1;
		var ISTFP = RawMove == null;
		var N_SIZE = N_RAW * N_SYM;
		var N_MOVES = IS_PHASE2 ? 10 : 18;
		var NEXT_AXIS_MAGIC = N_MOVES == 10 ? 0x42 : 0x92492;

		var depth = getPruning(PrunTable, N_SIZE) - 1;

		if (depth == -1) {
			for (var i = 0; i < (N_SIZE >> 3) + 1; i++) {
				PrunTable[i] = -1;
			}
			setPruning(PrunTable, 0, 0 ^ 0xf);
			depth = 0;
		} else {
			setPruning(PrunTable, N_SIZE, 0xf ^ (depth + 1));
		}

		var SEARCH_DEPTH = PARTIAL_INIT_LEVEL > 0 ?
			Math.min(Math.max(depth + 1, MIN_DEPTH), MAX_DEPTH) : MAX_DEPTH;

		while (depth < SEARCH_DEPTH) {
			var inv = depth > INV_DEPTH;
			var select = inv ? 0xf : depth;
			var selArrMask = select * 0x11111111;
			var check = inv ? depth : 0xf;
			depth++;
			InitPrunProgress++;
			var xorVal = depth ^ 0xf;
			var done = 0;
			var val = 0;
			for (var i = 0; i < N_SIZE; i++, val >>= 4) {
				if ((i & 7) == 0) {
					val = PrunTable[i >> 3];
					if (!hasZero(val ^ selArrMask)) {
						i += 7;
						continue;
					}
				}
				if ((val & 0xf) != select) {
					continue;
				}
				var raw = i % N_RAW;
				var sym = ~~(i / N_RAW);
				var flip = 0,
					fsym = 0;
				if (ISTFP) {
					flip = FlipR2S[raw];
					fsym = flip & 7;
					flip >>= 3;
				}

				for (var m = 0; m < N_MOVES; m++) {
					var symx = SymMove[sym * N_MOVES + m];
					var rawx;
					if (ISTFP) {
						rawx = FlipS2RF[
							FlipMove[flip * N_MOVES + Sym8Move[m << 3 | fsym]] ^
							fsym ^ (symx & SYM_MASK)];
					} else {
						rawx = RawConj[RawMove[raw * N_MOVES + m] << SYM_SHIFT | symx & SYM_MASK];
					}
					symx >>= SYM_SHIFT;
					var idx = symx * N_RAW + rawx;
					var prun = getPruning(PrunTable, idx);
					if (prun != check) {
						if (prun < depth - 1) {
							m += NEXT_AXIS_MAGIC >> m & 3;
						}
						continue;
					}
					done++;
					if (inv) {
						setPruning(PrunTable, i, xorVal);
						break;
					}
					setPruning(PrunTable, idx, xorVal);
					for (var j = 1, selfSym = SelfSym[symx];
							(selfSym >>= 1) != 0; j++) {
						if ((selfSym & 1) != 1) {
							continue;
						}
						var idxx = symx * N_RAW;
						if (ISTFP) {
							idxx += FlipS2RF[FlipR2S[rawx] ^ j];
						} else {
							idxx += RawConj[rawx << SYM_SHIFT | (j ^ (SYM_E2C_MAGIC >> (j << 1) & 3))];
						}
						if (getPruning(PrunTable, idxx) == check) {
							setPruning(PrunTable, idxx, xorVal);
							done++;
						}
					}
				}
			}
			// console.log(depth, done, InitPrunProgress);
		}
		setPruning(PrunTable, N_SIZE, (depth + 1) ^ 0xf);
		return depth + 1;
	}

	function doInitPrunTables(targetProgress) {
		if (USE_TWST_FLIP_PRUN) {
			TwstFlipPrunMax = initRawSymPrun(
				TwstFlipPrun, N_FLIP, N_TWST_SYM,
				null, null,
				TwstMove, TwstSelfSym, 0x19603
			);
		}
		if (InitPrunProgress > targetProgress) {
			return;
		}
		SliceTwstPrunMax = initRawSymPrun(
			SliceTwstPrun, N_SLICE, N_TWST_SYM,
			SliceMove, SliceConj,
			TwstMove, TwstSelfSym, 0x69603
		);
		if (InitPrunProgress > targetProgress) {
			return;
		}
		SliceFlipPrunMax = initRawSymPrun(
			SliceFlipPrun, N_SLICE, N_FLIP_SYM,
			SliceMove, SliceConj,
			FlipMove, FlipSelfSym, 0x69603
		);
		if (InitPrunProgress > targetProgress) {
			return;
		}
		MCPermPrunMax = initRawSymPrun(
			MCPermPrun, 24, N_PERM_SYM,
			MPermMove, MPermConj,
			CPermMove, PermSelfSym, 0x8ea34
		);
		if (InitPrunProgress > targetProgress) {
			return;
		}
		EPermCCombPPrunMax = initRawSymPrun(
			EPermCCombPPrun, N_COMB, N_PERM_SYM,
			CCombPMove, CCombPConj,
			EPermMove, PermSelfSym, 0x7d824
		);
	}

	function initPrunTables() {
		if (InitPrunProgress < 0) {
			initBasic();
			InitPrunProgress = 0;
		}
		if (InitPrunProgress == 0) {
			doInitPrunTables(99);
		} else if (InitPrunProgress < 54) {
			doInitPrunTables(InitPrunProgress);
		} else {
			return true;
		}
		return false;
	}

	function randomCube() {
		var ep, cp;
		var eo = ~~(Math.random() * 2048);
		var co = ~~(Math.random() * 2187);
		do {
			ep = ~~(Math.random() * fact[12]);
			cp = ~~(Math.random() * fact[8]);
		} while (getNParity(cp, 8) != getNParity(ep, 12));
		var cc = new CubieCube().initCoord(cp, co, ep, eo);
		return cc.toFaceCube();
	}
	function fromScramble(s) {
		var j = 0;
		var axis = -1;
		var c1 = new CubieCube();
		var c2 = new CubieCube();
		for (var i = 0; i < s.length; i++) {
			switch (s[i]) {
				case 'U':
				case 'R':
				case 'F':
				case 'D':
				case 'L':
				case 'B':
					axis = "URFDLB".indexOf(s[i]) * 3;
					break;
				case ' ':
					if (axis != -1) {
						CubieCube.CornMult(c1, moveCube[axis], c2);
						CubieCube.EdgeMult(c1, moveCube[axis], c2);
						c1.init(c2.ca, c2.ea);
					}
					axis = -1;
					break;
				case '2':
					axis++;
					break;
				case '\'':
					axis += 2;
					break;
				default:
					continue;
			}
		}
		if (axis != -1) {
			CubieCube.CornMult(c1, moveCube[axis], c2);
			CubieCube.EdgeMult(c1, moveCube[axis], c2);
			c1.init(c2.ca, c2.ea);
		}
		return c2.toFaceCube();
	}

	return {
		Search: Search,
		solve: function(facelet) {
			return new Search().solution(facelet);
		},
		randomCube: randomCube,
		fromScramble: fromScramble,
		initFull: function() {
			PARTIAL_INIT_LEVEL = 0;
			initPrunTables();
		},
		INVERSE_SOLUTION: INVERSE_SOLUTION
	}
})();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
	module.exports = min2phase;
}

"use strict";

var mathlib = (function() {
	var Cnk = [],
		fact = [1];
	for (var i = 0; i < 32; ++i) {
		Cnk[i] = [];
		for (var j = 0; j < 32; ++j) {
			Cnk[i][j] = 0;
		}
	}
	for (var i = 0; i < 32; ++i) {
		Cnk[i][0] = Cnk[i][i] = 1;
		fact[i + 1] = fact[i] * (i + 1);
		for (var j = 1; j < i; ++j) {
			Cnk[i][j] = Cnk[i - 1][j - 1] + Cnk[i - 1][j];
		}
	}

	var permMul4 = [];
	for (var i = 0; i < 24; i++) {
		var perm1 = [];
		var perm2 = [];
		var perm3 = [];
		permMul4[i] = [];
		setNPerm(perm1, i, 4);
		for (var j = 0; j < 24; j++) {
			setNPerm(perm2, j, 4);
			for (var k = 0; k < 4; k++) {
				perm3[k] = perm1[perm2[k]];
			}
			permMul4[i][j] = getNPerm(perm3, 4);
		}
	}

	function circleOri(arr, a, b, c, d, ori) {
		var temp = arr[a];
		arr[a] = arr[d] ^ ori;
		arr[d] = arr[c] ^ ori;
		arr[c] = arr[b] ^ ori;
		arr[b] = temp ^ ori;
	}

	function circle(arr) {
		var length = arguments.length - 1,
			temp = arr[arguments[length]];
		for (var i = length; i > 1; i--) {
			arr[arguments[i]] = arr[arguments[i - 1]];
		}
		arr[arguments[1]] = temp;
		return circle;
	}

	//perm: [idx1, idx2, ..., idxn]
	//pow: 1, 2, 3, ...
	//ori: ori1, ori2, ..., orin, base
	// arr[perm[idx2]] = arr[perm[idx1]] + ori[idx2] - ori[idx1] + base
	function acycle(arr, perm, pow, ori) {
		pow = pow || 1;
		var plen = perm.length;
		var tmp = [];
		for (var i = 0; i < plen; i++) {
			tmp[i] = arr[perm[i]];
		}
		for (var i = 0; i < plen; i++) {
			var j = (i + pow) % plen;
			arr[perm[j]] = tmp[i];
			if (ori) {
				arr[perm[j]] += ori[j] - ori[i] + ori.at(-1);
			}
		}
		return acycle;
	}

	function getPruning(table, index) {
		return table[index >> 3] >> ((index & 7) << 2) & 15;
	}

	function setNPerm(arr, idx, n, even) {
		var prt = 0;
		if (even < 0) {
			idx <<= 1;
		}
		if (n >= 16) {
			arr[n - 1] = 0;
			for (var i = n - 2; i >= 0; i--) {
				arr[i] = idx % (n - i);
				prt ^= arr[i];
				idx = ~~(idx / (n - i));
				for (var j = i + 1; j < n; j++) {
					arr[j] >= arr[i] && arr[j]++;
				}
			}
			if (even < 0 && (prt & 1) != 0) {
				var tmp = arr[n - 1];
				arr[n - 1] = arr[n - 2];
				arr[n - 2] = tmp;
			}
			return arr;
		}
		var vall = 0x76543210;
		var valh = 0xfedcba98;
		for (var i = 0; i < n - 1; i++) {
			var p = fact[n - 1 - i];
			var v = idx / p;
			idx = idx % p;
			prt ^= v;
			v <<= 2;
			if (v >= 32) {
				v = v - 32;
				arr[i] = valh >> v & 0xf;
				var m = (1 << v) - 1;
				valh = (valh & m) + ((valh >> 4) & ~m);
			} else {
				arr[i] = vall >> v & 0xf;
				var m = (1 << v) - 1;
				vall = (vall & m) + ((vall >>> 4) & ~m) + (valh << 28);
				valh = valh >> 4;
			}
		}
		if (even < 0 && (prt & 1) != 0) {
			arr[n - 1] = arr[n - 2];
			arr[n - 2] = vall & 0xf;
		} else {
			arr[n - 1] = vall & 0xf;
		}
		return arr;
	}

	function getNPerm(arr, n, even) {
		n = n || arr.length;
		var idx = 0;
		if (n >= 16) {
			for (var i = 0; i < n - 1; i++) {
				idx *= n - i;
				for (var j = i + 1; j < n; j++) {
					arr[j] < arr[i] && idx++;
				}
			}
			return even < 0 ? (idx >> 1) : idx;
		}
		var vall = 0x76543210;
		var valh = 0xfedcba98;
		for (var i = 0; i < n - 1; i++) {
			var v = arr[i] << 2;
			idx *= n - i;
			if (v >= 32) {
				idx += (valh >> (v - 32)) & 0xf;
				valh -= 0x11111110 << (v - 32);
			} else {
				idx += (vall >> v) & 0xf;
				valh -= 0x11111111;
				vall -= 0x11111110 << v;
			}
		}
		return even < 0 ? (idx >> 1) : idx;
	}

	function getNParity(idx, n) {
		var i, p;
		p = 0;
		for (i = n - 2; i >= 0; --i) {
			p ^= idx % (n - i);
			idx = ~~(idx / (n - i));
		}
		return p & 1;
	}

	function getNOri(arr, n, evenbase) {
		var base = Math.abs(evenbase);
		var idx = evenbase < 0 ? 0 : arr[0] % base;
		for (var i = n - 1; i > 0; i--) {
			idx = idx * base + arr[i] % base;
		}
		return idx;
	}

	function setNOri(arr, idx, n, evenbase) {
		var base = Math.abs(evenbase);
		var parity = base * n;
		for (var i = 1; i < n; i++) {
			arr[i] = idx % base;
			parity -= arr[i];
			idx = ~~(idx / base);
		}
		arr[0] = (evenbase < 0 ? parity : idx) % base;
		return arr;
	}

	function bitCount(x) {
		x -= (x >> 1) & 0x55555555;
		x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
		return ((x + (x >> 4) & 0xf0f0f0f) * 0x1010101) >> 24;
	}

	function getMPerm(arr, n, cnts, cums) {
		var seen = ~0;
		var idx = 0;
		var x = 1;
		for (var i = 0; i < n; i++) {
			var pi = arr[i];
			idx = idx * (n - i) + bitCount(seen & ((1 << cums[pi]) - 1)) * x;
			x = x * cnts[pi]--;
			seen &= ~(1 << (cums[pi] + cnts[pi]));
		}
		return Math.round(idx / x);
	}

	function setMPerm(arr, idx, n, cnts, x) {
		for (var i = 0; i < n; i++) {
			for (var j = 0; j < cnts.length; j++) {
				if (cnts[j] == 0) {
					continue;
				}
				var x2 = ~~(x * cnts[j] / (n - i));
				if (idx < x2) {
					cnts[j]--;
					arr[i] = j;
					x = x2;
					break;
				}
				idx -= x2;
			}
		}
		return arr;
	}

	// type: 'p' (permutation), 'o' (orientation), 'c' (combination)
	// evenbase: base for ori, sign for even parity, cnts for combination
	function Coord(type, length, evenbase) {
		this.length = length;
		this.evenbase = evenbase;
		if (type == 'p') {
			this.get = function(arr) {
				return getNPerm(arr, this.length, this.evenbase);
			};
			this.set = function(arr, idx) {
				return setNPerm(arr, idx, this.length, this.evenbase);
			};
		} else if (type == 'o') {
			this.get = function(arr) {
				return getNOri(arr, this.length, this.evenbase);
			};
			this.set = function(arr, idx) {
				return setNOri(arr, idx, this.length, this.evenbase);
			};
		} else if (type == 'c') {
			var cnts = evenbase;
			this.cnts = cnts.slice();
			this.cntn = this.cnts.length;
			this.cums = [0];
			for (var i = 1; i <= this.cntn; i++) {
				this.cums[i] = this.cums[i - 1] + cnts[i - 1];
			}
			this.n = this.cums[this.cntn];
			var n = this.n;
			var x = 1;
			for (var i = 0; i < this.cntn; i++) {
				for (var j = 1; j <= cnts[i]; j++, n--) {
					x *= n / j;
				}
			}
			this.x = Math.round(x);
			this.get = function(arr) {
				return getMPerm(arr, this.n, this.cnts.slice(), this.cums);
			};
			this.set = function(arr, idx) {
				return setMPerm(arr, idx, this.n, this.cnts.slice(), this.x);
			};
		} else { // invalid type
			debugger;
		}
	}

	function fillFacelet(facelets, f, perm, ori, divcol) {
		for (var i = 0; i < facelets.length; i++) {
			var cubie = facelets[i];
			var p = perm[i] === undefined ? i : perm[i];
			if (typeof(cubie) == 'number') {
				f[cubie] = ~~(facelets[p] / divcol);
				continue;
			}
			var o = ori[i] || 0;
			for (var j = 0; j < cubie.length; j++) {
				f[cubie[(j + o) % cubie.length]] = ~~(facelets[p][j] / divcol);
			}
		}
	}

	function detectFacelet(facelets, f, perm, ori, divcol) {
		for (var i = 0; i < facelets.length; i++) {
			var n_ori = facelets[i].length;
			out: for (var j = 0; j < facelets.length + 1; j++) {
				if (j == facelets.length) { // not matched
					return -1;
				} else if (facelets[j].length != n_ori) {
					continue;
				}
				for (var o = 0; o < n_ori; o++) {
					var isMatch = true;
					for (var t = 0; t < n_ori; t++) {
						if (~~(facelets[j][t] / divcol) != f[facelets[i][(t + o) % n_ori]]) {
							isMatch = false;
							break;
						}
					}
					if (isMatch) {
						perm[i] = j;
						ori[i] = o;
						break out;
					}
				}
			}
		}
		return 0;
	}

	function createMove(moveTable, size, doMove, N_MOVES) {
		N_MOVES = N_MOVES || 6;
		if ($.isArray(doMove)) {
			var cord = new Coord(doMove[1], doMove[2], doMove[3]);
			doMove = doMove[0];
			for (var j = 0; j < N_MOVES; j++) {
				moveTable[j] = [];
				for (var i = 0; i < size; i++) {
					var arr = cord.set([], i);
					doMove(arr, j);
					moveTable[j][i] = cord.get(arr);
				}
			}
		} else {
			for (var j = 0; j < N_MOVES; j++) {
				moveTable[j] = [];
				for (var i = 0; i < size; i++) {
					moveTable[j][i] = doMove(i, j);
				}
			}
		}
	}

	function createMoveHash(initState, validMoves, hashFunc, moveFunc) {
		var states = [initState];
		var hash2idx = {};
		var depthEnds = [];
		hash2idx[hashFunc(initState)] = 0;
		depthEnds[0] = 1;
		var moveTable = [];
		for (var m = 0; m < validMoves.length; m++) {
			moveTable[m] = [];
		}
		var tt = +new Date;
		for (var i = 0; i < states.length; i++) {
			if (i == depthEnds.at(-1)) {
				depthEnds.push(states.length);
			}
			if (i % 10000 == 9999) {
				DEBUG && console.log(i, 'states scanned, tt=', +new Date - tt);
			}
			var curState = states[i];
			for (var m = 0; m < validMoves.length; m++) {
				var newState = moveFunc(curState, validMoves[m]);
				if (!newState) {
					moveTable[m][i] = -1;
					continue;
				}
				var newHash = hashFunc(newState);
				if (!(newHash in hash2idx)) {
					hash2idx[newHash] = states.length;
					states.push(newState);
				}
				moveTable[m][i] = hash2idx[newHash];
			}
		}
		DEBUG && console.log('[move hash] ' + states.length + ' states generated, tt=', +new Date - tt, JSON.stringify(depthEnds));
		return [moveTable, hash2idx];
	}

	function edgeMove(arr, m) {
		if (m == 0) { //F
			circleOri(arr, 0, 7, 8, 4, 1);
		} else if (m == 1) { //R
			circleOri(arr, 3, 6, 11, 7, 0);
		} else if (m == 2) { //U
			circleOri(arr, 0, 1, 2, 3, 0);
		} else if (m == 3) { //B
			circleOri(arr, 2, 5, 10, 6, 1);
		} else if (m == 4) { //L
			circleOri(arr, 1, 4, 9, 5, 0);
		} else if (m == 5) { //D
			circleOri(arr, 11, 10, 9, 8, 0);
		}
	}

	function CubieCube() {
		this.ca = [0, 1, 2, 3, 4, 5, 6, 7];
		this.ea = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
		this.ori = 0;
	}

	CubieCube.SOLVED = new CubieCube();

	CubieCube.EdgeMult = function(a, b, prod) {
		for (var ed = 0; ed < 12; ed++) {
			prod.ea[ed] = a.ea[b.ea[ed] >> 1] ^ (b.ea[ed] & 1);
		}
	};

	CubieCube.CornMult = function(a, b, prod) {
		for (var corn = 0; corn < 8; corn++) {
			var ori = ((a.ca[b.ca[corn] & 7] >> 3) + (b.ca[corn] >> 3)) % 3;
			prod.ca[corn] = a.ca[b.ca[corn] & 7] & 7 | ori << 3;
		}
	};

	CubieCube.CubeMult = function(a, b, prod) {
		CubieCube.CornMult(a, b, prod);
		CubieCube.EdgeMult(a, b, prod);
	};

	CubieCube.CentMult = function(a, b, prod) {
		prod.ct = [];
		for (var cent = 0; cent < 6; cent++) {
			prod.ct[cent] = a.ct[b.ct[cent]];
		}
	};

	CubieCube.prototype.init = function(ca, ea) {
		this.ca = ca.slice();
		this.ea = ea.slice();
		return this;
	};

	CubieCube.prototype.hashCode = function() {
		var ret = 0;
		for (var i = 0; i < 20; i++) {
			ret = 0 | (ret * 31 + (i < 12 ? this.ea[i] : this.ca[i - 12]));
		}
		return ret;
	}

	CubieCube.prototype.isEqual = function(c) {
		c = c || CubieCube.SOLVED;
		for (var i = 0; i < 8; i++) {
			if (this.ca[i] != c.ca[i]) {
				return false;
			}
		}
		for (var i = 0; i < 12; i++) {
			if (this.ea[i] != c.ea[i]) {
				return false;
			}
		}
		return true;
	};

	CubieCube.cFacelet = [
		[8, 9, 20], // URF
		[6, 18, 38], // UFL
		[0, 36, 47], // ULB
		[2, 45, 11], // UBR
		[29, 26, 15], // DFR
		[27, 44, 24], // DLF
		[33, 53, 42], // DBL
		[35, 17, 51]  // DRB
	];
	CubieCube.eFacelet = [
		[5, 10], // UR
		[7, 19], // UF
		[3, 37], // UL
		[1, 46], // UB
		[32, 16], // DR
		[28, 25], // DF
		[30, 43], // DL
		[34, 52], // DB
		[23, 12], // FR
		[21, 41], // FL
		[50, 39], // BL
		[48, 14]  // BR
	];
	CubieCube.ctFacelet = [4, 13, 22, 31, 40, 49]; // centers
	CubieCube.faceMap = (function() {
		var f = [];
		for (var c = 0; c < 8; c++) {
			for (var n = 0; n < 3; n++) {
				f[CubieCube.cFacelet[c][n]] = [0, c, n];
			}
		}
		for (var e = 0; e < 12; e++) {
			for (var n = 0; n < 2; n++)
				f[CubieCube.eFacelet[e][n]] = [1, e, n];
		}
		return f;
	})();

	CubieCube.prototype.toPerm = function(cFacelet, eFacelet, ctFacelet, withOri) {
		cFacelet = cFacelet || CubieCube.cFacelet;
		eFacelet = eFacelet || CubieCube.eFacelet;
		ctFacelet = ctFacelet || CubieCube.ctFacelet;
		var f = [];
		for (var i = 0; i < 54; i++) {
			f[i] = i;
		}
		var obj = this;
		if (withOri && obj.ori) {
			obj = new CubieCube();
			var rot = CubieCube.rotCube[CubieCube.rotMulI[0][this.ori]];
			CubieCube.CubeMult(this, rot, obj);
			for (var i = 0; i < 6; i++) {
				f[ctFacelet[i]] = ctFacelet[rot.ct[i]];
			}
		}
		for (var c = 0; c < 8; c++) {
			var j = obj.ca[c] & 0x7; // cornercubie with index j is at
			var ori = obj.ca[c] >> 3; // Orientation of this cubie
			for (var n = 0; n < 3; n++)
				f[cFacelet[c][(n + ori) % 3]] = cFacelet[j][n];
		}
		for (var e = 0; e < 12; e++) {
			var j = obj.ea[e] >> 1; // edgecubie with index j is at edgeposition
			var ori = obj.ea[e] & 1; // Orientation of this cubie
			for (var n = 0; n < 2; n++)
				f[eFacelet[e][(n + ori) % 2]] = eFacelet[j][n];
		}
		return f;
	}

	CubieCube.prototype.toFaceCube = function(cFacelet, eFacelet, ctFacelet, withOri) {
		var perm = this.toPerm(cFacelet, eFacelet, ctFacelet, withOri);
		var ts = "URFDLB";
		var f = [];
		for (var i = 0; i < 54; i++) {
			f[i] = ts[~~(perm[i] / 9)];
		}
		return f.join("");
	}

	CubieCube.prototype.prettyString = function(withOri) {
		var facelet = this.toFaceCube(null, null, null, withOri);
		var tmp =
			"        U0U1U2\n" +
			"        U3U4U5\n" +
			"        U6U7U8\n" +
			"L0L1L2  F0F1F2  R0R1R2  B0B1B2\n" +
			"L3L4L5  F3F4F5  R3R4R5  B3B4B5\n" +
			"L6L7L8  F6F7F8  R6R7R8  B6B7B8\n" +
			"        D0D1D2\n" +
			"        D3D4D5\n" +
			"        D6D7D8\n";
		return tmp.replace(/[URFDLB][0-8]/g, function(m) {
			var i1 = "URFDLB".indexOf(m[0]);
			return facelet[i1 * 9 + ~~m[1]] + ' ';
		});
	}

	CubieCube.prototype.invFrom = function(cc) {
		for (var edge = 0; edge < 12; edge++) {
			this.ea[cc.ea[edge] >> 1] = edge << 1 | cc.ea[edge] & 1;
		}
		for (var corn = 0; corn < 8; corn++) {
			this.ca[cc.ca[corn] & 0x7] = corn | 0x20 >> (cc.ca[corn] >> 3) & 0x18;
		}
		return this;
	}

	CubieCube.prototype.fromFacelet = function(facelet, cFacelet, eFacelet) {
		cFacelet = cFacelet || CubieCube.cFacelet;
		eFacelet = eFacelet || CubieCube.eFacelet;
		var count = 0;
		var f = [];
		var centers = facelet[4] + facelet[13] + facelet[22] + facelet[31] + facelet[40] + facelet[49];
		for (var i = 0; i < 54; ++i) {
			f[i] = centers.indexOf(facelet[i]);
			if (f[i] == -1) {
				return -1;
			}
			count += 1 << (f[i] << 2);
		}
		if (count != 0x999999) {
			return -1;
		}
		var col1, col2, i, j, ori;
		for (i = 0; i < 8; ++i) {
			for (ori = 0; ori < 3; ++ori)
				if (f[cFacelet[i][ori]] == 0 || f[cFacelet[i][ori]] == 3)
					break;
			col1 = f[cFacelet[i][(ori + 1) % 3]];
			col2 = f[cFacelet[i][(ori + 2) % 3]];
			for (j = 0; j < 8; ++j) {
				if (col1 == ~~(cFacelet[j][1] / 9) && col2 == ~~(cFacelet[j][2] / 9)) {
					this.ca[i] = j | ori % 3 << 3;
					break;
				}
			}
		}
		for (i = 0; i < 12; ++i) {
			for (j = 0; j < 12; ++j) {
				if (f[eFacelet[i][0]] == ~~(eFacelet[j][0] / 9) && f[eFacelet[i][1]] == ~~(eFacelet[j][1] / 9)) {
					this.ea[i] = j << 1;
					break;
				}
				if (f[eFacelet[i][0]] == ~~(eFacelet[j][1] / 9) && f[eFacelet[i][1]] == ~~(eFacelet[j][0] / 9)) {
					this.ea[i] = j << 1 | 1;
					break;
				}
			}
		}
		return this;
	}

	CubieCube.prototype.verify = function() {
		var mask = 0;
		var sum = 0;
		var ep = [];
		for (var e = 0; e < 12; e++) {
			mask |= 1 << 8 << (this.ea[e] >> 1);
			sum ^= this.ea[e] & 1;
			ep.push(this.ea[e] >> 1);
		}
		var cp = [];
		for (var c = 0; c < 8; c++) {
			mask |= 1 << (this.ca[c] & 7);
			sum += this.ca[c] >> 3 << 1;
			cp.push(this.ca[c] & 0x7);
		}
		if (mask != 0xfffff || sum % 6 != 0
				|| getNParity(getNPerm(ep, 12), 12) != getNParity(getNPerm(cp, 8), 8)) {
			return -1;
		}
		return 0;
	}

	CubieCube.moveCube = (function() {
		var moveCube = [];
		for (var i = 0; i < 18; i++) {
			moveCube[i] = new CubieCube();
		}
		moveCube[0].init([3, 0, 1, 2, 4, 5, 6, 7], [6, 0, 2, 4, 8, 10, 12, 14, 16, 18, 20, 22]);
		moveCube[3].init([20, 1, 2, 8, 15, 5, 6, 19], [16, 2, 4, 6, 22, 10, 12, 14, 8, 18, 20, 0]);
		moveCube[6].init([9, 21, 2, 3, 16, 12, 6, 7], [0, 19, 4, 6, 8, 17, 12, 14, 3, 11, 20, 22]);
		moveCube[9].init([0, 1, 2, 3, 5, 6, 7, 4], [0, 2, 4, 6, 10, 12, 14, 8, 16, 18, 20, 22]);
		moveCube[12].init([0, 10, 22, 3, 4, 17, 13, 7], [0, 2, 20, 6, 8, 10, 18, 14, 16, 4, 12, 22]);
		moveCube[15].init([0, 1, 11, 23, 4, 5, 18, 14], [0, 2, 4, 23, 8, 10, 12, 21, 16, 18, 7, 15]);
		for (var a = 0; a < 18; a += 3) {
			for (var p = 0; p < 2; p++) {
				CubieCube.CubeMult(moveCube[a + p], moveCube[a], moveCube[a + p + 1]);
			}
		}
		return moveCube;
	})();

	CubieCube.rotCube = (function() {
		var u4 = new CubieCube().init([3, 0, 1, 2, 7, 4, 5, 6], [6, 0, 2, 4, 14, 8, 10, 12, 23, 17, 19, 21]);
		u4.ct = [0, 5, 1, 3, 2, 4];
		var f2 = new CubieCube().init([5, 4, 7, 6, 1, 0, 3, 2], [12, 10, 8, 14, 4, 2, 0, 6, 18, 16, 22, 20]);
		f2.ct = [3, 4, 2, 0, 1, 5];
		var urf = new CubieCube().init([8, 20, 13, 17, 19, 15, 22, 10], [3, 16, 11, 18, 7, 22, 15, 20, 1, 9, 13, 5]);
		urf.ct = [2, 0, 1, 5, 3, 4];
		var c = new CubieCube();
		c.ct = [0, 1, 2, 3, 4, 5];
		var d = new CubieCube();
		var rotCube = [];
		for (var i = 0; i < 24; i++) {
			rotCube[i] = new CubieCube().init(c.ca, c.ea);
			rotCube[i].ct = c.ct.slice();
			CubieCube.CubeMult(c, u4, d);
			CubieCube.CentMult(c, u4, d);
			c.init(d.ca, d.ea);
			c.ct = d.ct.slice();
			if (i % 4 == 3) {
				CubieCube.CubeMult(c, f2, d);
				CubieCube.CentMult(c, f2, d);
				c.init(d.ca, d.ea);
				c.ct = d.ct.slice();
			}
			if (i % 8 == 7) {
				CubieCube.CubeMult(c, urf, d);
				CubieCube.CentMult(c, urf, d);
				c.init(d.ca, d.ea);
				c.ct = d.ct.slice();
			}
		}

		var movHash = [];
		var rotHash = [];
		var rotMult = [];
		var rotMulI = [];
		var rotMulM = [];
		for (var i = 0; i < 24; i++) {
			rotHash[i] = rotCube[i].hashCode();
			rotMult[i] = [];
			rotMulI[i] = [];
			rotMulM[i] = [];
		}
		for (var i = 0; i < 18; i++) {
			movHash[i] = CubieCube.moveCube[i].hashCode();
		}
		for (var i = 0; i < 24; i++) {
			for (var j = 0; j < 24; j++) {
				CubieCube.CubeMult(rotCube[i], rotCube[j], c);
				var k = rotHash.indexOf(c.hashCode());
				rotMult[i][j] = k;
				rotMulI[k][j] = i;
			}
		}
		for (var i = 0; i < 24; i++) {
			for (var j = 0; j < 18; j++) {
				CubieCube.CubeMult(rotCube[rotMulI[0][i]], CubieCube.moveCube[j], c);
				CubieCube.CubeMult(c, rotCube[i], d);
				var k = movHash.indexOf(d.hashCode());
				rotMulM[i][j] = k;
			}
		}

		var rot2str = [
			"", "y'", "y2", "y",
			"z2", "y' z2", "y2 z2", "y z2",
			"y' x'", "y2 x'", "y x'", "x'",
			"y' x", "y2 x", "y x", "x",
			"y z", "z", "y' z", "y2 z",
			"y' z'", "y2 z'", "y z'", "z'"
		];

		CubieCube.rotMult = rotMult;
		CubieCube.rotMulI = rotMulI;
		CubieCube.rotMulM = rotMulM;
		CubieCube.rot2str = rot2str;
		return rotCube;
	})();

	CubieCube.prototype.edgeCycles = function() {
		var visited = [];
		var small_cycles = [0, 0, 0];
		var cycles = 0;
		var parity = false;
		for (var x = 0; x < 12; ++x) {
			if (visited[x]) {
				continue
			}
			var length = -1;
			var flip = false;
			var y = x;
			do {
				visited[y] = true;
				++length;
				flip ^= this.ea[y] & 1;
				y = this.ea[y] >> 1;
			} while (y != x);
			cycles += length >> 1;
			if (length & 1) {
				parity = !parity;
				++cycles;
			}
			if (flip) {
				if (length == 0) {
					++small_cycles[0];
				} else if (length & 1) {
					small_cycles[2] ^= 1;
				} else {
					++small_cycles[1];
				}
			}
		}
		small_cycles[1] += small_cycles[2];
		if (small_cycles[0] < small_cycles[1]) {
			cycles += (small_cycles[0] + small_cycles[1]) >> 1;
		} else {
			var flip_cycles = [0, 2, 3, 5, 6, 8, 9];
			cycles += small_cycles[1] + flip_cycles[(small_cycles[0] - small_cycles[1]) >> 1];
		}
		return cycles - parity;
	};

	var CubeMoveRE = /^\s*([URFDLB]w?|[EMSyxz]|2-2[URFDLB]w)(['2]?)(@\d+)?\s*$/;
	var tmpCubie = new CubieCube();
	CubieCube.prototype.selfMoveStr = function(moveStr, isInv) {
		var m = CubeMoveRE.exec(moveStr);
		if (!m) {
			return;
		}
		var face = m[1];
		var pow = "2'".indexOf(m[2] || '-') + 2;
		if (isInv) {
			pow = 4 - pow;
		}
		if (m[3]) {
			this.tstamp = ~~m[3].slice(1);
		}
		this.ori = this.ori || 0;
		var axis = 'URFDLB'.indexOf(face);
		if (axis != -1) {
			m = axis * 3 + pow % 4 - 1
			m = CubieCube.rotMulM[this.ori][m];
			CubieCube.CubeMult(this, CubieCube.moveCube[m], tmpCubie);
			this.init(tmpCubie.ca, tmpCubie.ea);
			return m;
		}
		axis = 'UwRwFwDwLwBw'.indexOf(face);
		if (axis != -1) {
			axis >>= 1;
			m = (axis + 3) % 6 * 3 + pow % 4 - 1
			m = CubieCube.rotMulM[this.ori][m];
			CubieCube.CubeMult(this, CubieCube.moveCube[m], tmpCubie);
			this.init(tmpCubie.ca, tmpCubie.ea);
			var rot = [3, 15, 17, 1, 11, 23][axis];
			for (var i = 0; i < pow; i++) {
				this.ori = CubieCube.rotMult[rot][this.ori];
			}
			return m;
		}
		axis = ['2-2Uw', '2-2Rw', '2-2Fw', '2-2Dw', '2-2Lw', '2-2Bw'].indexOf(face);
		if (axis == -1) {
			axis = [null, null, 'S', 'E', 'M', null].indexOf(face);
		}
		if (axis != -1) {
			var m1 = axis * 3 + (4 - pow) % 4 - 1;
			var m2 = (axis + 3) % 6 * 3 + pow % 4 - 1;
			m1 = CubieCube.rotMulM[this.ori][m1];
			CubieCube.CubeMult(this, CubieCube.moveCube[m1], tmpCubie);
			this.init(tmpCubie.ca, tmpCubie.ea);
			m2 = CubieCube.rotMulM[this.ori][m2];
			CubieCube.CubeMult(this, CubieCube.moveCube[m2], tmpCubie);
			this.init(tmpCubie.ca, tmpCubie.ea);
			var rot = [3, 15, 17, 1, 11, 23][axis];
			for (var i = 0; i < pow; i++) {
				this.ori = CubieCube.rotMult[rot][this.ori];
			}
			return m1 + 18;
		}
		axis = 'yxz'.indexOf(face);
		if (axis != -1) {
			var rot = [3, 15, 17][axis];
			for (var i = 0; i < pow; i++) {
				this.ori = CubieCube.rotMult[rot][this.ori];
			}
			return;
		}
	}

	CubieCube.prototype.selfConj = function(conj) {
		if (conj === undefined) {
			conj = this.ori;
		}
		if (conj != 0) {
			CubieCube.CubeMult(CubieCube.rotCube[conj], this, tmpCubie);
			CubieCube.CubeMult(tmpCubie, CubieCube.rotCube[CubieCube.rotMulI[0][conj]], this);
			this.ori = CubieCube.rotMulI[this.ori][conj] || 0;
		}
	}

	var minx = (function() {
		var U = 0, R = 1, F = 2, L = 3, BL = 4, BR = 5, DR = 6, DL = 7, DBL = 8, B = 9, DBR = 10, D = 11;
		var oppFace = [D, DBL, B, DBR, DR, DL, BL, BR, R, F, L, U];
		var adjFaces = [
			[BR, R, F, L, BL], //U
			[DBR, DR, F, U, BR], //R
			[DR, DL, L, U, R], //F
			[DL, DBL, BL, U, F], //L
			[DBL, B, BR, U, L], //BL
			[B, DBR, R, U, BL], //BR
			[D, DL, F, R, DBR], //DR
			[D, DBL, L, F, DR], //DL
			[D, B, BL, L, DL], //DBL
			[D, DBR, BR, BL, DBL], //B
			[D, DR, R, BR, B], //DBR
			[DR, DBR, B, DBL, DL]  //D
		];

		// wide: 0=single, 1=all, 2=all but single
		// state: corn*5, edge*5, center*1
		function doMove(state, face, pow, wide) {
			pow = (pow % 5 + 5) % 5;
			if (pow == 0) {
				return;
			}
			var base = face * 11;
			var adjs = [];
			var swaps = [[], [], [], [], []];
			for (var i = 0; i < 5; i++) {
				var aface = adjFaces[face][i];
				var ridx = adjFaces[aface].indexOf(face);
				if (wide == 0 || wide == 1) {
					swaps[i].push(
						base + i,
						base + i + 5,
						aface * 11 + ridx % 5 + 5,
						aface * 11 + ridx % 5,
						aface * 11 + (ridx + 1) % 5);
				}
				if (wide == 1 || wide == 2) {
					swaps[i].push(aface * 11 + 10);
					for (var j = 1; j < 5; j++) {
						swaps[i].push(aface * 11 + (ridx + j) % 5 + 5);
					}
					for (var j = 2; j < 5; j++) {
						swaps[i].push(aface * 11 + (ridx + j) % 5);
					}
					var ii = 4 - i;
					var opp = oppFace[face];
					var oaface = adjFaces[opp][ii];
					var oridx = adjFaces[oaface].indexOf(opp);
					swaps[i].push(
						opp * 11 + ii,
						opp * 11 + ii + 5,
						oaface * 11 + 10);
					for (var j = 0; j < 5; j++) {
						swaps[i].push(
							oaface * 11 + (oridx + j) % 5 + 5,
							oaface * 11 + (oridx + j) % 5);
					}
				}
			}
			for (var i = 0; i < swaps[0].length; i++) {
				mathlib.acycle(state, [swaps[0][i], swaps[1][i], swaps[2][i], swaps[3][i], swaps[4][i]], pow);
			}
		}

		return {
			doMove: doMove,
			oppFace: oppFace,
			adjFaces: adjFaces
		}
	})();

	function createPrun(prun, init, size, maxd, doMove, N_MOVES, N_POWER, N_INV) {
		var isMoveTable = $.isArray(doMove);
		N_MOVES = N_MOVES || 6;
		N_POWER = N_POWER || 3;
		N_INV = N_INV || 256;
		maxd = maxd || 256;
		for (var i = 0, len = (size + 7) >>> 3; i < len; i++) {
			prun[i] = -1;
		}
		if (!$.isArray(init)) {
			init = [init];
		}
		for (var i = 0; i < init.length; i++) {
			prun[init[i] >> 3] ^= 15 << ((init[i] & 7) << 2);
		}
		var val = 0;
		// var t = +new Date;
		for (var l = 0; l <= maxd; l++) {
			var done = 0;
			var inv = l >= N_INV;
			var fill = (l + 1) ^ 15;
			var find = inv ? 0xf : l;
			var check = inv ? l : 0xf;

			out: for (var p = 0; p < size; p++, val >>= 4) {
				if ((p & 7) == 0) {
					val = prun[p >> 3];
					if (!inv && val == -1) {
						p += 7;
						continue;
					}
				}
				if ((val & 0xf) != find) {
					continue;
				}
				for (var m = 0; m < N_MOVES; m++) {
					var q = p;
					for (var c = 0; c < N_POWER; c++) {
						q = isMoveTable ? doMove[m][q] : doMove(q, m);
						if (q < 0) {
							break;
						}
						if (getPruning(prun, q) != check) {
							continue;
						}
						++done;
						if (inv) {
							prun[p >> 3] ^= fill << ((p & 7) << 2);
							continue out;
						}
						prun[q >> 3] ^= fill << ((q & 7) << 2);
					}
				}
			}
			if (done == 0) {
				break;
			}
			DEBUG && console.log('[prun]', done);
		}
	}

	// stateParams: [[init, doMove, size, [maxd], [N_INV]], [...]...]
	function Solver(N_MOVES, N_POWER, stateParams) {
		this.N_STATES = stateParams.length;
		this.N_MOVES = N_MOVES;
		this.N_POWER = N_POWER;
		this.stateParams = stateParams;
		this.coords = [];
		for (var i = 0; i < this.N_STATES; i++) {
			var doMove = stateParams[i][1];
			if ($.isArray(doMove)) {
				this.coords[i] = new Coord(doMove[1], doMove[2], doMove[3]);
			}
		}
		this.inited = false;
	}

	var _ = Solver.prototype;

	_.init = function() {
		if (this.inited) {
			return;
		}
		this.move = [];
		this.prun = [];
		for (var i = 0; i < this.N_STATES; i++) {
			var stateParam = this.stateParams[i];
			var init = stateParam[0];
			var doMove = stateParam[1];
			var size = stateParam[2];
			var maxd = stateParam[3];
			var N_INV = stateParam[4];
			this.move[i] = [];
			this.prun[i] = [];
			createMove(this.move[i], size, doMove, this.N_MOVES);
			createPrun(this.prun[i], init, size, maxd, this.move[i], this.N_MOVES, this.N_POWER, N_INV);
		}
		this.solv = new Searcher(null, (state) => {
			var prun = 0;
			for (var i = 0; i < this.N_STATES; i++) {
				prun = Math.max(prun, getPruning(this.prun[i], state[i]));
			}
			return prun;
		}, (state, move) => {
			for (var i = 0; i < this.N_STATES; i++) {
				state[i] = this.move[i][move][state[i]];
			}
			return state;
		}, this.N_MOVES, this.N_POWER);
		this.inited = true;
	}

	_.search = function(state, minl, MAXL) {
		MAXL = MAXL || 99;
		if (!this.inited) {
			this.init();
		}
		this.sol = this.solv.solve(state, minl, MAXL);
		return this.sol;
	};

	_.toStr = function(sol, move_map, power_map) {
		return sol.map((move) => move_map[move[0]] + power_map[move[1]]).join(' ').replace(/ +/g, ' ');
	};

	// ida search algorithm
	// isSolved(state) -> boolean, in case isSolved = null, getPrun(idx) == 0 is used
	// getPrun(state) -> int
	// doMove(state) -> newState
	// if ckmv[last_move] >> cur_move & 1, cur_move is skipped
	function Searcher(isSolved, getPrun, doMove, N_AXIS, N_POWER, ckmv) {
		this.isSolved = isSolved || function() { return true; };
		this.getPrun = getPrun;
		this.doMove = doMove;
		this.N_AXIS = N_AXIS;
		this.N_POWER = N_POWER;
		this.ckmv = ckmv || valuedArray(N_AXIS, function(i) { return 1 << i; } );
	}

	_ = Searcher.prototype;

	_.solve = function(idx, minl, MAXL, callback, cost) {
		var sols = this.solveMulti([idx], minl, MAXL, callback, cost);
		return sols == null ? null : sols[0];
	};

	_.solveMulti = function(idxs, minl, MAXL, callback, cost) {
		this.sidx = 0;
		this.sol = [];
		this.length = minl;
		this.idxs = idxs;
		return this.nextMulti(MAXL, callback, cost);
	};

	_.next = function(MAXL, callback, cost) {
		var sols = this.nextMulti(MAXL, callback, cost);
		return sols == null ? null : sols[0];
	};

	_.nextMulti = function(MAXL, callback, cost) {
		this.cost = (cost || 1e9) + 1;
		this.callback = callback || function() { return true; };
		for (; this.length <= MAXL; this.length++) {
			for (; this.sidx < this.idxs.length; this.sidx++) {
				if (this.idaSearch(this.idxs[this.sidx], this.length, 0, -1, this.sol) == 0) {
					return this.cost <= 0 ? null : [this.sol, this.sidx];
				}
			}
			this.sidx = 0;
		}
		return null;
	}

	_.idaSearch = function(idx, maxl, depth, lm, sol) {
		if (--this.cost <= 0) {
			return 0;
		}
		var prun = this.getPrun(idx);
		if (prun > maxl) {
			return prun > maxl + 1 ? 2 : 1;
		} else if (maxl == 0) {
			return this.isSolved(idx) && this.callback(sol, this.sidx) ? 0 : 1;
		} else if (prun == 0 && maxl == 1 && this.isSolved(idx)) {
			return 1;
		}
		var axis = sol.length > depth ? sol[depth][0] : 0;
		for (; axis < this.N_AXIS; axis++) {
			if (this.ckmv[lm] >> axis & 1) {
				continue;
			}
			var idx1 = $.isArray(idx) ? idx.slice() : idx;
			var pow = sol.length > depth ? sol[depth][1] : 0;
			for (; pow < this.N_POWER; pow++) {
				idx1 = this.doMove(idx1, axis, pow);
				if (idx1 == null) {
					break;
				}
				sol[depth] = [axis, pow];
				var ret = this.idaSearch(idx1, maxl - 1, depth + 1, axis, sol);
				if (ret == 0) {
					return 0;
				}
				sol.pop();
				if (ret == 2) {
					break;
				}
			}
		}
		return 1;
	};

	// state: string not null
	// solvedStates: [solvedstate, solvedstate, ...], string not null
	// moveFunc: function(state, move);
	// moves: {move: face0 | axis0}, face0 | axis0 = 4 + 4 bits
	function gSolver(solvedStates, doMove, moves) {
		this.solvedStates = solvedStates;
		this.doMove = doMove;
		this.movesList = [];
		for (var move in moves) {
			this.movesList.push([move, moves[move]]);
		}
		this.prunTable = {};
		this.toUpdateArr = null;
		this.prunTableSize = 0;
		this.prunDepth = -1;
		this.cost = 0;
		this.MAX_PRUN_SIZE = 100000;
	}

	_ = gSolver.prototype;

	_.updatePrun = function(targetDepth) {
		targetDepth = targetDepth === undefined ? this.prunDepth + 1 : targetDepth;
		for (var depth = this.prunDepth + 1; depth <= targetDepth; depth++) {
			if (this.prevSize >= this.MAX_PRUN_SIZE) {
				DEBUG && console.log('[gSolver] skipPrun', depth, this.prunTableSize);
				break;
			}
			var t = +new Date;
			if (depth < 1) {
				this.prevSize = 0;
				for (var i = 0; i < this.solvedStates.length; i++) {
					var state = this.solvedStates[i];
					if (!(state in this.prunTable)) {
						this.prunTable[state] = depth;
						this.prunTableSize++;
					}
				}
			} else {
				this.updatePrunBFS(depth - 1);
			}
			if (this.cost == 0) {
				return;
			}
			this.prunDepth = depth;
			DEBUG && console.log('[gSolver] updatePrun', depth, this.prunTableSize - this.prevSize, +new Date - t);
			this.prevSize = this.prunTableSize;
		}
	};

	_.updatePrunBFS = function(fromDepth) {
		if (this.toUpdateArr == null) {
			this.toUpdateArr = [];
			for (var state in this.prunTable) {
				if (this.prunTable[state] != fromDepth) {
					continue;
				}
				this.toUpdateArr.push(state);
			}
		}
		while (this.toUpdateArr.length != 0) {
			var state = this.toUpdateArr.pop();
			for (var moveIdx = 0; moveIdx < this.movesList.length; moveIdx++) {
				var newState = this.doMove(state, this.movesList[moveIdx][0]);
				if (!newState || newState in this.prunTable) {
					continue;
				}
				this.prunTable[newState] = fromDepth + 1;
				this.prunTableSize++;
			}
			if (this.cost >= 0) {
				if (this.cost == 0) {
					return;
				}
				this.cost--;
			}
		}
		this.toUpdateArr = null;
	};

	_.search = function(state, minl, MAXL) {
		this.sol = [];
		this.subOpt = false;
		this.state = state;
		this.visited = {};
		this.maxl = minl = minl || 0;
		return this.searchNext(MAXL);
	};

	_.searchNext = function(MAXL, cost) {
		MAXL = (MAXL + 1) || 99;
		this.prevSolStr = this.solArr ? this.solArr.join(',') : null;
		this.solArr = null;
		this.cost = cost || -1;
		for (; this.maxl < MAXL; this.maxl++) {
			this.updatePrun(Math.ceil(this.maxl / 2));
			if (this.cost == 0) {
				return null;
			}
			if (this.idaSearch(this.state, this.maxl, null, 0)) {
				break;
			}
		}
		return this.solArr;
	}

	_.getPruning = function(state) {
		var prun = this.prunTable[state];
		return prun === undefined ? this.prunDepth + 1 : prun;
	};

	_.idaSearch = function(state, maxl, lm, depth) {
		if (this.getPruning(state) > maxl) {
			return false;
		}
		if (maxl == 0) {
			if (this.solvedStates.indexOf(state) == -1) {
				return false;
			}
			var solArr = this.sol.map((move) => this.movesList[move][0]);
			this.subOpt = true;
			if (solArr.join(',') == this.prevSolStr) {
				return false;
			}
			this.solArr = solArr;
			return true;
		}
		if (!this.subOpt) {
			if (state in this.visited && this.visited[state] < depth) {
				return false;
			}
			this.visited[state] = depth;
		}
		if (this.cost >= 0) {
			if (this.cost == 0) {
				return true;
			}
			this.cost--;
		}
		var lastMove = lm == null ? '' : this.movesList[lm][0];
		var lastAxisFace = lm == null ? -1 : this.movesList[lm][1];
		for (var moveIdx = this.sol[depth] || 0; moveIdx < this.movesList.length; moveIdx++) {
			var moveArgs = this.movesList[moveIdx];
			var axisface = moveArgs[1] ^ lastAxisFace;
			var move = moveArgs[0];
			if (axisface == 0 ||
				(axisface & 0xf) == 0 && move <= lastMove) {
				continue;
			}
			var newState = this.doMove(state, move);
			if (!newState || newState == state) {
				continue;
			}
			this.sol[depth] = moveIdx;
			if (this.idaSearch(newState, maxl - 1, moveIdx, depth + 1)) {
				return true;
			}
			this.sol.pop();
		}
		return false;
	};

	var randGen = (function() {
		var rndFunc;
		var rndCnt;
		var seedStr; // '' + new Date().getTime();

		function random() {
			rndCnt++;
			// console.log(rndCnt);
			return rndFunc();
		}

		function getSeed() {
			return [rndCnt, seedStr];
		}

		function setSeed(_rndCnt, _seedStr) {
			if (_seedStr && (_seedStr != seedStr || rndCnt > _rndCnt)) {
				var seed = [];
				for (var i = 0; i < _seedStr.length; i++) {
					seed[i] = _seedStr.charCodeAt(i);
				}
				isaac.seed(seed);
				rndFunc = isaac.random;
				rndCnt = 0;
				seedStr = _seedStr;
			}
			while (rndCnt < _rndCnt) {
				rndFunc();
				rndCnt++;
			}
		}

		var seed = '' + new Date().getTime();
		if (typeof crypto != 'undefined' && crypto.getRandomValues) {
			seed = String.fromCharCode.apply(null, crypto.getRandomValues(new Uint16Array(256)));
			DEBUG && console.log('[mathlib] use crypto seed', seed);
		} else {
			DEBUG && console.log('[mathlib] use datetime seed', seed);
		}
		setSeed(256, seed);

		return {
			random: random,
			getSeed: getSeed,
			setSeed: setSeed
		};
	})();

	function rndEl(x) {
		return x[~~(randGen.random() * x.length)];
	}

	function rn(n) {
		return ~~(randGen.random() * n)
	}

	function rndHit(prob) {
		return randGen.random() < prob;
	}

	function rndPerm(n, isEven) {
		var p = 0;
		var arr = [];
		for (var i = 0; i < n; i++) {
			arr[i] = i;
		}
		for (var i = 0; i < n - 1; i++) {
			var k = rn(n - i);
			circle(arr, i, i + k);
			p ^= k != 0;
		}
		if (isEven && p) {
			circle(arr, 0, 1);
		}
		return arr;
	}

	function rndProb(plist) {
		var cum = 0;
		var curIdx = 0;
		for (var i = 0; i < plist.length; i++) {
			if (plist[i] == 0) {
				continue;
			}
			if (randGen.random() < plist[i] / (cum + plist[i])) {
				curIdx = i;
			}
			cum += plist[i];
		}
		return curIdx;
	}

	function time2str(unix, format) {
		if (!unix) {
			return 'N/A';
		}
		format = format || '%Y-%M-%D %h:%m:%s';
		var date = new Date(unix * 1000);
		return format
			.replace('%Y', date.getFullYear())
			.replace('%M', ('0' + (date.getMonth() + 1)).slice(-2))
			.replace('%D', ('0' + date.getDate()).slice(-2))
			.replace('%h', ('0' + date.getHours()).slice(-2))
			.replace('%m', ('0' + date.getMinutes()).slice(-2))
			.replace('%s', ('0' + date.getSeconds()).slice(-2))
			.replace('%S', ('00' + date.getMilliseconds()).slice(-3));
	}

	var timeRe = /^\s*(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)\s*$/;

	function str2time(val) {
		var m = timeRe.exec(val);
		if (!m) {
			return null;
		}
		var date = new Date(1970, 0, 1);
		date.setFullYear(~~m[1]);
		date.setMonth(~~m[2] - 1);
		date.setDate(~~m[3]);
		date.setHours(~~m[4]);
		date.setMinutes(~~m[5]);
		date.setSeconds(~~m[6]);
		return ~~(date.getTime() / 1000);
	}

	function obj2str(val) {
		if (typeof val == 'string') {
			return val;
		}
		return JSON.stringify(val);
	}

	function str2obj(val) {
		if (typeof val != 'string') {
			return val;
		}
		return JSON.parse(val);
	}

	function valuedArray(len, val) {
		var ret = [];
		var isFun = typeof val == 'function';
		for (var i = 0; i < len; i++) {
			ret[i] = isFun ? val(i) : val;
		}
		return ret;
	}

	function idxArray(arr, idx) {
		return arr.map((elem) => elem[idx]);
	}

	function permOriMult(p1, p2, prod, o1, o2, ori, oriMod) {
		for (var i = 0; i < p2.length; i++) {
			if (oriMod) {
				ori[i] = (o1[p2[i]] + o2[i]) % oriMod;
			}
			prod[i] = p1[p2[i]];
		}
	}

	Math.TAU = Math.PI * 2;

	return {
		Cnk: Cnk,
		fact: fact,
		bitCount: bitCount,
		getPruning: getPruning,
		setNOri: setNOri,
		getNOri: getNOri,
		setNPerm: setNPerm,
		getNPerm: getNPerm,
		getNParity: getNParity,
		permMul4: permMul4,
		Coord: Coord,
		createMove: createMove,
		createMoveHash: createMoveHash,
		edgeMove: edgeMove,
		circle: circle,
		circleOri: circleOri,
		acycle: acycle,
		createPrun: createPrun,
		CubieCube: CubieCube,
		minx: minx,
		SOLVED_FACELET: "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB",
		fillFacelet: fillFacelet,
		detectFacelet: detectFacelet,
		rn: rn,
		rndEl: rndEl,
		rndProb: rndProb,
		rndHit: rndHit,
		time2str: time2str,
		str2time: str2time,
		obj2str: obj2str,
		str2obj: str2obj,
		valuedArray: valuedArray,
		idxArray: idxArray,
		Solver: Solver,
		Searcher: Searcher,
		rndPerm: rndPerm,
		permOriMult: permOriMult,
		gSolver: gSolver,
		getSeed: randGen.getSeed,
		setSeed: randGen.setSeed
	};
})();

/*

scramble_333.js

3x3x3 Solver / Scramble Generator in Javascript.

The core 3x3x3 code is from a min2phase solver by Shuang Chen.
Compiled to Javascript using GWT.
(There may be a lot of redundant code right now, but it's still really fast.)

 */
"use strict";

var scramble_333 = (function(getNPerm, setNPerm, getNParity, rn, rndEl) {

	var Ux1 = 0,
		Ux2 = 1,
		Ux3 = 2,
		Rx1 = 3,
		Rx2 = 4,
		Rx3 = 5,
		Fx1 = 6,
		Fx2 = 7,
		Fx3 = 8,
		Dx1 = 9,
		Dx2 = 10,
		Dx3 = 11,
		Lx1 = 12,
		Lx2 = 13,
		Lx3 = 14,
		Bx1 = 15,
		Bx2 = 16,
		Bx3 = 17;

	function renderFacelet(solved, cc, resultMap) {
		var f = cc.toPerm();
		var ret = [];
		for (var i = 0; i < resultMap.length; i++) {
			ret[i] = solved[f[resultMap[i]]];
		}
		return ret.join('');
	}

	// SCRAMBLERS

	var search = new min2phase.Search();

	function getRandomScramble() {
		return getAnyScramble(0xffffffffffff, 0xffffffffffff, 0xffffffff, 0xffffffff);
	}

	function getFMCScramble() {
		var scramble = getAnyScramble(0xffffffffffff, 0xffffffffffff, 0xffffffff, 0xffffffff, 0, undefined, undefined, 2, 1);
		return "R' U' F " + scramble + "R' U' F";
	}

	function cntU(b) {
		for (var c = 0, a = 0; a < b.length; a++) - 1 == b[a] && c++;
		return c
	}

	function fixOri(arr, cntU, base) {
		var sum = 0;
		var idx = 0;
		for (var i = 0; i < arr.length; i++) {
			if (arr[i] != -1) {
				sum += arr[i];
			}
		}
		sum %= base;
		for (var i = 0; i < arr.length - 1; i++) {
			if (arr[i] == -1) {
				if (cntU-- == 1) {
					arr[i] = ((base << 4) - sum) % base;
				} else {
					arr[i] = rn(base);
					sum += arr[i];
				}
			}
			idx *= base;
			idx += arr[i];
		}
		if (cntU == 1) {
			arr.splice(-1, 1, ((base << 4) - sum) % base);
		}
		return idx;
	}

	function fixPerm(arr, cntU, parity) {
		var val = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
		for (var i = 0; i < arr.length; i++) {
			if (arr[i] != -1) {
				val[arr[i]] = -1;
			}
		}
		for (var i = 0, j = 0; i < val.length; i++) {
			if (val[i] != -1) {
				val[j++] = val[i];
			}
		}
		var last;
		for (var i = 0; i < arr.length && cntU > 0; i++) {
			if (arr[i] == -1) {
				var r = rn(cntU);
				arr[i] = val[r];
				for (var j = r; j < 11; j++) {
					val[j] = val[j + 1];
				}
				if (cntU-- == 2) {
					last = i;
				}
			}
		}
		if (getNParity(getNPerm(arr, arr.length), arr.length) == 1 - parity) {
			var temp = arr[i - 1];
			arr[i - 1] = arr[last];
			arr[last] = temp;
		}
		return getNPerm(arr, arr.length);
	}

	//arr: 53 bit integer
	function parseMask(arr, length) {
		if ('number' !== typeof arr) {
			return arr;
		}
		var ret = [];
		for (var i = 0; i < length; i++) {
			var val = arr & 0xf; // should use "/" instead of ">>" to avoid unexpected type conversion
			ret[i] = val == 15 ? -1 : val;
			arr /= 16;
		}
		return ret;
	}

	var aufsuff = [
		[],
		[Ux1],
		[Ux2],
		[Ux3]
	];

	var rlpresuff = [
		[],
		[Rx1, Lx3],
		[Rx2, Lx2],
		[Rx3, Lx1]
	];

	var rlappsuff = ["", "x'", "x2", "x"];

	var emptysuff = [
		[]
	];

	function getAnyScramble(_ep, _eo, _cp, _co, neut, _rndapp, _rndpre, firstAxisFilter, lastAxisFilter) {
		_rndapp = _rndapp || emptysuff;
		_rndpre = _rndpre || emptysuff;
		_ep = parseMask(_ep, 12);
		_eo = parseMask(_eo, 12);
		_cp = parseMask(_cp, 8);
		_co = parseMask(_co, 8);
		var solution = "";
		do {
			var eo = _eo.slice();
			var ep = _ep.slice();
			var co = _co.slice();
			var cp = _cp.slice();
			var neo = fixOri(eo, cntU(eo), 2);
			var nco = fixOri(co, cntU(co), 3);
			var nep, ncp;
			var ue = cntU(ep);
			var uc = cntU(cp);
			if (ue == 1) {
				fixPerm(ep, ue, -1);
				ue = 0;
			}
			if (uc == 1) {
				fixPerm(cp, uc, -1);
				uc = 0;
			}
			if (ue == 0 && uc == 0) {
				nep = getNPerm(ep, 12);
				ncp = getNPerm(cp, 8);
			} else if (ue != 0 && uc == 0) {
				ncp = getNPerm(cp, 8);
				nep = fixPerm(ep, ue, getNParity(ncp, 8));
			} else if (ue == 0 && uc != 0) {
				nep = getNPerm(ep, 12);
				ncp = fixPerm(cp, uc, getNParity(nep, 12));
			} else {
				nep = fixPerm(ep, ue, -1);
				ncp = fixPerm(cp, uc, getNParity(nep, 12));
			}
			if (ncp + nco + nep + neo == 0) {
				continue;
			}
			var rndpre = rndEl(_rndpre);
			var rndapp = rndEl(_rndapp);
			var cc = new mathlib.CubieCube();
			var cd = new mathlib.CubieCube();
			for (var i = 0; i < 12; i++) {
				cc.ea[i] = ep[i] << 1 | eo[i];
				if (i < 8) {
					cc.ca[i] = co[i] << 3 | cp[i];
				}
			}
			for (var i = 0; i < rndpre.length; i++) {
				mathlib.CubieCube.CubeMult(mathlib.CubieCube.moveCube[rndpre[i]], cc, cd);
				cc.init(cd.ca, cd.ea);
			}
			for (var i = 0; i < rndapp.length; i++) {
				mathlib.CubieCube.CubeMult(cc, mathlib.CubieCube.moveCube[rndapp[i]], cd);
				cc.init(cd.ca, cd.ea);
			}
			if (neut) {
				cc.ori = mathlib.rn([1, 4, 8, 1, 1, 1, 24][neut]);
				cc.selfConj();
				cc.ori = 0;
			}
			var posit = cc.toFaceCube();
			solution = search.solution(posit, 21, 1e9, 50, 2, lastAxisFilter, firstAxisFilter);
		} while (solution.length <= 3);
		return solution.replace(/ +/g, ' ');
	}

	function getEdgeScramble() {
		return getAnyScramble(0xffffffffffff, 0xffffffffffff, 0x76543210, 0x00000000);
	}

	function getCornerScramble() {
		return getAnyScramble(0xba9876543210, 0x000000000000, 0xffffffff, 0xffffffff);
	}

	function getLLScramble(type, length, cases, neut) {
		return getAnyScramble(0xba987654ffff, 0x00000000ffff, 0x7654ffff, 0x0000ffff, neut);
	}

	var f2l_map = [
		[0x2000, 4, 'Easy-01'],
		[0x1011, 4, 'Easy-02'],
		[0x2012, 4, 'Easy-03'],
		[0x1003, 4, 'Easy-04'],
		[0x2003, 4, 'RE-05'],
		[0x1012, 4, 'RE-06'],
		[0x2002, 4, 'RE-07'],
		[0x1013, 4, 'RE-08'],
		[0x2013, 4, 'REFC-09'],
		[0x1002, 4, 'REFC-10'],
		[0x2010, 4, 'REFC-11'],
		[0x1001, 4, 'REFC-12'],
		[0x2011, 4, 'REFC-13'],
		[0x1000, 4, 'REFC-14'],
		[0x2001, 4, 'SPGO-15'],
		[0x1010, 4, 'SPGO-16'],
		[0x0000, 4, 'SPGO-17'],
		[0x0011, 4, 'SPGO-18'],
		[0x0003, 4, 'PMS-19'],
		[0x0012, 4, 'PMS-20'],
		[0x0002, 4, 'PMS-21'],
		[0x0013, 4, 'PMS-22'],
		[0x0001, 4, 'Weird-23'],
		[0x0010, 4, 'Weird-24'],
		[0x0400, 4, 'CPEU-25'],
		[0x0411, 4, 'CPEU-26'],
		[0x1400, 4, 'CPEU-27'],
		[0x2411, 4, 'CPEU-28'],
		[0x1411, 4, 'CPEU-29'],
		[0x2400, 4, 'CPEU-30'],
		[0x0018, 4, 'EPCU-31'],
		[0x0008, 4, 'EPCU-32'],
		[0x2008, 4, 'EPCU-33'],
		[0x1008, 4, 'EPCU-34'],
		[0x2018, 4, 'EPCU-35'],
		[0x1018, 4, 'EPCU-36'],
		[0x0418, 1, 'ECP-37'],
		[0x1408, 1, 'ECP-38'],
		[0x2408, 1, 'ECP-39'],
		[0x1418, 1, 'ECP-40'],
		[0x2418, 1, 'ECP-41'],
		[0x0408, 1, 'Solved-42']
	];
	var f2lprobs = mathlib.idxArray(f2l_map, 1);
	var f2lfilter = mathlib.idxArray(f2l_map, 2);

	function getLSLLScramble(type, length, cases, neut) {
		var caze = f2l_map[scrMgr.fixCase(cases, f2lprobs)][0];
		var ep = Math.pow(16, caze & 0xf);
		var eo = 0xf ^ (caze >> 4 & 1);
		var cp = Math.pow(16, caze >> 8 & 0xf);
		var co = 0xf ^ (caze >> 12 & 3);
		return getAnyScramble(0xba9f7654ffff - 7 * ep, 0x000f0000ffff - eo * ep, 0x765fffff - 0xb * cp, 0x000fffff - co * cp, neut, aufsuff);
	}

	var eols_map = [];
	var eolsprobs = [];
	var eolsfilter = [];
	for (var i = 0; i < f2l_map.length; i++) {
		if (f2l_map[i][0] & 0xf0) {
			continue;
		}
		eols_map.push(f2l_map[i]);
		eolsprobs.push(f2lprobs[i]);
		eolsfilter.push(f2lfilter[i]);
	}

	function getEOLSScramble(type, length, cases, neut) {
		var caze = eols_map[scrMgr.fixCase(cases, eolsprobs)][0];
		var ep = Math.pow(16, caze & 0xf);
		var cp = Math.pow(16, caze >> 8 & 0xf);
		var co = 0xf ^ (caze >> 12 & 3);
		return getAnyScramble(0xba9f7654ffff - 7 * ep, 0x000000000000, 0x765fffff - 0xb * cp, 0x000fffff - co * cp, neut, aufsuff);
	}

	function getF2LImage(piece0, stmap, stprobs, cases, canvas) {
		var emap = [[5, 10], [7, 19], [3, -1], [1, -1], null, null, null, null, [23, 12]];
		var cmap = [[8, 20, 9], [6, -1, 18], [0, -1, -1], [2, 11, -1], [-1, 15, 26]];
		var caze = stmap[scrMgr.fixCase(cases, stprobs)][0];
		var ep = emap[caze & 0xf];
		var eo = caze >> 4 & 1;
		var cp = cmap[caze >> 8 & 0xf];
		var co = caze >> 12 & 3;
		var pieces = piece0.split('');
		for (var i1 = 0; i1 < 3; i1++) {
			if (i1 < 2 && ep[i1] >= 0) {
				pieces[ep[i1]] = 'BR'.charAt(eo ^ i1);
			}
			if (cp[i1] >= 0) {
				pieces[cp[i1]] = 'URB'.charAt((co + 3 + i1) % 3);
			}
		}
		image.face3Image(pieces.join(''), canvas);
	}

	var wvls_map = [];
	var wvlsprobs = [];
	var wvlsfilter = [
		'Oriented', 'Rectangle-1', 'Rectangle-2', 'Tank-1', 'Bowtie-1', 'Bowtie-3', 'Tank-2', 'Bowtie-2', 'Bowtie-4', 'Snake-1', 'Adjacent-1', 'Adjacent-2', 'Gun-Far', 'Sune-1', 'Pi-Near', 'Gun-Back', 'Pi-Front', 'H-Side', 'Snake-2', 'Adjacent-3', 'Adjacent-4', 'Gun-Sides', 'H-Front', 'Pi-Back', 'Gun-Near', 'Pi-Far', 'Sune-2'
	];

	for (var i = 0; i < 27; i++) {
		wvls_map[i] = ~~(i / 9) << 12 | ~~(i / 3) % 3 << 8 | i % 3;
		wvlsprobs[i] = 1;
	}

	function getWVLSScramble(type, length, cases, neut) {
		var caze = wvls_map[scrMgr.fixCase(cases, wvlsprobs)];
		return getAnyScramble(0xba9f7654ff8f, 0x000000000000, 0x765fff4f, 0x000f0020 | caze, neut);
	}

	function getWVLSImage(cases, canvas) {
		var caze = wvls_map[scrMgr.fixCase(cases, wvlsprobs)];
		var fill = ['DGG', 'GDG', 'GGD'];
		fill = fill[caze & 3] + fill[caze >> 8 & 3] + fill[caze >> 12 & 3];
		image.llImage.drawImage('3D6DDDBB0RR21G87G54GU'.replace(/[0-9]/g, function(v) {
			return fill[~~v];
		}), null, canvas);
	}

	var vls_map = [];
	var vlsprobs = [];
	var vlsfilter = [];

	for (var i = 0; i < 27 * 8; i++) {
		var co = i % 27;
		var eo = ~~(i / 27);
		vls_map[i] = [~~(co / 9) % 3 << 12 | ~~(co / 3) % 3 << 8 | co % 3, (eo >> 2 & 1) << 12 | (eo >> 1 & 1) << 8 | eo & 1];
		vlsprobs[i] = 1;
		vlsfilter[i] = ["WVLS", "UB", "UF", "UF UB", "UL", "UB UL", "UF UL", "No Edge"][eo] + "-" + (co + 1);
	}

	function getVLSScramble(type, length, cases, neut) {
		var caze = vls_map[scrMgr.fixCase(cases, vlsprobs)];
		return getAnyScramble(0xba9f7654ff8f, 0x000f00000000 + caze[1], 0x765fff4f, 0x000f0020 + caze[0], neut, [[Ux3]]);
	}

	function getVLSImage(cases, canvas) {
		var caze = vls_map[scrMgr.fixCase(cases, vlsprobs)];
		var fillc = ['DGG', 'GDG', 'GGD'];
		fillc = fillc[caze[0] & 3] + fillc[caze[0] >> 8 & 3] + fillc[caze[0] >> 12 & 3];
		var fille = ['DG', 'GD'];
		fille = fille[caze[1] & 3] + fille[caze[1] >> 8 & 3] + fille[caze[1] >> 12 & 3];
		image.llImage.drawImage('6a0eDR3cR4dUFF21b87f5'.replace(/[0-9]/g, function(v) {
			return fillc[~~v];
		}).replace(/[a-z]/g, function(v) {
			return fille[v.charCodeAt(0) - 'a'.charCodeAt(0)];
		}), null, canvas);
	}

	function getF2LScramble(type, length, cases, neut) {
		return getAnyScramble(0xffff7654ffff, 0xffff0000ffff, 0xffffffff, 0xffffffff, neut);
	}

	function genZBLLMap() {
		var isVisited = [];
		var zbll_map = [];
		var cc = new mathlib.CubieCube();
		for (var idx = 0; idx < 27 * 24 * 24; idx++) {
			if (isVisited[idx >> 5] >> (idx & 0x1f) & 1) {
				continue;
			}
			var epi = idx % 24;
			var cpi = ~~(idx / 24) % 24;
			var coi = ~~(idx / 24 / 24);
			if (mathlib.getNParity(cpi, 4) != mathlib.getNParity(epi, 4)) {
				continue;
			}
			var co = mathlib.setNOri([], coi, 4, -3);
			var cp = mathlib.setNPerm([], cpi, 4, 0);
			var ep = mathlib.setNPerm([], epi, 4, 0);
			var zbcase = [0, 0, 0, null, 0, null];
			for (var i = 0; i < 4; i++) {
				zbcase[0] += cp[i] << i * 4;
				zbcase[1] += co[i] << i * 4;
				zbcase[2] += ep[i] << i * 4;
			}
			for (var conj = 0; conj < 16; conj++) {
				var c0 = conj >> 2;
				var c1 = conj & 3;
				var co2 = [], cp2 = [], ep2 = [];
				for (var i = 0; i < 4; i++) {
					co2[(i + c0) & 3] = co[i];
					cp2[(i + c0) & 3] = (cp[i] + c1) & 3;
					ep2[(i + c0) & 3] = (ep[i] + c1) & 3;
				}
				var co2i = mathlib.getNOri(co2, 4, -3);
				var cp2i = mathlib.getNPerm(cp2, 4, 0);
				var ep2i = mathlib.getNPerm(ep2, 4, 0);
				var idx2 = (co2i * 24 + cp2i) * 24 + ep2i;
				if (isVisited[idx2 >> 5] >> (idx2 & 0x1f) & 1) {
					continue;
				}
				isVisited[idx2 >> 5] |= 1 << (idx2 & 0x1f);
				zbcase[4]++;
			}
			for (var i = 0; i < 12; i++) {
				cc.ea[i] = ep[i] << 1;
				if (i < 8) {
					cc.ca[i] = co[i] << 3 | cp[i];
				}
			}
			zbcase[3] = renderFacelet("DDDDDDDDDLLLLLLLLLFFFFFFFFFUUUUUUUUURRRRRRRRRBBBBBBBBB",
				cc, [0, 1, 2, 3, 4, 5, 6, 7, 8, 18, 19, 20, 9, 10, 11, 45, 46, 47, 36, 37, 38]);
			if (idx > 0) { // skip solved state
				zbll_map.push(zbcase);
			}
		}

		var coNames = {}
		coNames[0x0000] = 'O';
		coNames[0x0012] = 'U';
		coNames[0x0021] = 'T';
		coNames[0x0102] = 'L';
		coNames[0x0111] = 'aS';
		coNames[0x0222] = 'S';
		coNames[0x1122] = 'Pi';
		coNames[0x1212] = 'H';
		var coCnts = {};
		for (var i = 0; i < zbll_map.length; i++) {
			var zbcase = zbll_map[i];
			var coName = coNames[zbcase[1]];
			coCnts[coName] = coCnts[coName] || [];
			var coCnt = coCnts[coName];
			var cpIdx = coCnt.indexOf(zbcase[0]);
			if (cpIdx == -1) {
				cpIdx = coCnt.length;
				coCnt.push(zbcase[0], 1);
			} else {
				coCnt[cpIdx + 1]++;
			}
			zbcase[5] = coName + ((cpIdx >> 1) + 1) + '-' + coCnts[coName][cpIdx + 1];
		}
		return zbll_map;
	}

	var zbll_map = genZBLLMap();
	var zbprobs = mathlib.idxArray(zbll_map, 4);
	var zbfilter = mathlib.idxArray(zbll_map, 5);

	function getZBLLScramble(type, length, cases, neut) {
		var zbcase = zbll_map[scrMgr.fixCase(cases, zbprobs)];
		return getAnyScramble(zbcase[2] + 0xba9876540000, 0, zbcase[0] + 0x76540000, zbcase[1], neut, aufsuff, aufsuff);
	}

	function getZBLLx2Scramble(type, length, cases, neut, filter) {
		var A = zbll_map[scrMgr.fixCase(cases, zbprobs)];
		var B = zbll_map[scrMgr.rndState(filter, zbprobs)];
		var EM = [4, 7, 6, 5], cp = A[0], co = A[1], ep = A[2] + 0xba9800000000;
		for (var i = 0; i < 4; i++) {
			cp += (7 - (B[0] >> (4 * i) & 15)) * Math.pow(16, 7 - i);
			co += (B[1] >> (4 * i) & 15) * Math.pow(16, 7 - i);
			ep += EM[B[2] >> (4 * i) & 15] * Math.pow(16, EM[i]);
		}
		return getAnyScramble(ep, 0, cp, co, neut, udaufsuff, emptysuff);
	}

	function getZBLLImage(cases, canvas) {
		var face = zbll_map[cases][3];
		if (!canvas) {
			return [face, null, zbfilter[cases]];
		}
		image.llImage.drawImage(face, null, canvas);
	}

	var coll_map = [
		[0x3210, 0x2121, 'FeFeeeBeBLGRDGDRGLDGD', 2, 'H-1'],
		[0x2301, 0x1212, 'ReLeeeReLBGBDGDFGFDGD', 2, 'H-2'],
		[0x1203, 0x1212, 'ReBeeeLeBFGRDGDLGFDGD', 4, 'H-3'],
		[0x2013, 0x1212, 'LeReeeFeFRGLDGDBGBDGD', 4, 'H-4'],
		[0x3021, 0x1020, 'DeLeeeReDBGRFGBDGFLGD', 4, 'L-1'],
		[0x1203, 0x0201, 'DeReeeLeDFGBRGFDGLBGD', 4, 'L-2'],
		[0x2301, 0x0102, 'DeBeeeLeDFGRFGRDGLBGD', 4, 'L-3'],
		[0x3210, 0x1020, 'DeLeeeFeDRGFLGBDGBRGD', 4, 'L-4'],
		[0x3102, 0x1020, 'DeLeeeLeDFGBRGBDGRFGD', 4, 'L-5'],
		[0x2013, 0x0201, 'DeReeeReDBGLBGFDGFLGD', 4, 'L-6'],
		[0x3210, 0x1122, 'LeFeeeReFBGDRGLDGBDGD', 4, 'Pi-1'],
		[0x2301, 0x2112, 'FeLeeeFeRRGDBGBDGLDGD', 4, 'Pi-2'],
		[0x1203, 0x1221, 'ReLeeeReLBGDFGBDGFDGD', 4, 'Pi-3'],
		[0x3102, 0x1122, 'BeFeeeFeBRGDLGLDGRDGD', 4, 'Pi-4'],
		[0x2013, 0x1221, 'BeLeeeLeFFGDRGBDGRDGD', 4, 'Pi-5'],
		[0x3021, 0x1122, 'BeReeeLeBFGDLGFDGRDGD', 4, 'Pi-6'],
		[0x3210, 0x2220, 'ReBeeeFeDRGFLGDLGDBGD', 4, 'S-1'],
		[0x2301, 0x0222, 'BeReeeLeDFGRFGDBGDLGD', 4, 'S-2'],
		[0x3021, 0x2220, 'BeReeeFeDRGFLGDBGDLGD', 4, 'S-3'],
		[0x2013, 0x2202, 'ReBeeeLeDFGRFGDLGDBGD', 4, 'S-4'],
		[0x3102, 0x2220, 'FeBeeeLeDFGBRGDLGDRGD', 4, 'S-5'],
		[0x1203, 0x2202, 'LeReeeFeDRGLBGDBGDFGD', 4, 'S-6'],
		[0x1203, 0x1002, 'BeLeeeDeDBGRFGDFGRDGL', 4, 'T-1'],
		[0x3102, 0x2100, 'ReBeeeDeDLGBRGDLGFDGF', 4, 'T-2'],
		[0x2301, 0x0210, 'BeFeeeDeDBGFLGDRGRDGL', 4, 'T-3'],
		[0x3210, 0x2100, 'FeFeeeDeDBGBRGDRGLDGL', 4, 'T-4'],
		[0x2013, 0x1002, 'BeBeeeDeDLGRFGDLGRDGF', 4, 'T-5'],
		[0x3021, 0x2100, 'FeBeeeDeDRGRFGDLGLDGB', 4, 'T-6'],
		[0x2301, 0x0120, 'LeLeeeDeDFGBRGBDGDFGR', 4, 'U-1'],
		[0x3210, 0x1200, 'LeReeeDeDBGBRGFDGDFGL', 4, 'U-2'],
		[0x3021, 0x1200, 'FeFeeeDeDBGBRGLDGDRGL', 4, 'U-3'],
		[0x2013, 0x2001, 'BeFeeeDeDFGBRGLDGDLGR', 4, 'U-4'],
		[0x1203, 0x2001, 'ReFeeeDeDBGRFGLDGDBGL', 4, 'U-5'],
		[0x3102, 0x1200, 'LeBeeeDeDBGRFGRDGDFGL', 4, 'U-6'],
		[0x3210, 0x1101, 'LeFeeeDeRRGFDGLDGBDGB', 4, 'aS-1'],
		[0x2301, 0x1110, 'ReFeeeDeLRGBDGLDGFDGB', 4, 'aS-2'],
		[0x3021, 0x1101, 'LeBeeeDeFFGLDGRDGBDGR', 4, 'aS-3'],
		[0x2013, 0x1011, 'LeFeeeDeBFGRDGLDGBDGR', 4, 'aS-4'],
		[0x1203, 0x1011, 'FeBeeeDeLFGBDGRDGLDGR', 4, 'aS-5'],
		[0x3102, 0x1101, 'FeBeeeDeRBGFDGRDGLDGL', 4, 'aS-6'],
		[0x3021, 0x0000, 'DeDeeeDeDBGRFGBRGFLGL', 4, 'O-Adj'],
		[0x2301, 0x0000, 'DeDeeeDeDBGFLGRFGBRGL', 1, 'O-Diag'],
		[0x3210, 0x0000, 'DeDeeeDeDBGBRGRFGFLGL', 1, 'O-AUF']
	];
	var coprobs = mathlib.idxArray(coll_map, 3);
	var cofilter = mathlib.idxArray(coll_map, 4);

	function getCOLLScramble(type, length, cases, neut) {
		var cocase = coll_map[scrMgr.fixCase(cases, coprobs)];
		return getAnyScramble(0xba987654ffff, 0, cocase[0] + 0x76540000, cocase[1], neut, aufsuff, aufsuff);
	}

	function getCMLLScramble(type, length, cases) {
		var cocase = coll_map[scrMgr.fixCase(cases, coprobs)];
		var rnd4 = rn(4);
		var presuff = [];
		for (var i = 0; i < aufsuff.length; i++) {
			presuff.push(aufsuff[i].concat(rlpresuff[rnd4]));
		}
		return getAnyScramble(0xba98f6f4ffff, 0x0000f0f0ffff, cocase[0] + 0x76540000, cocase[1], 0, presuff, aufsuff) + rlappsuff[rnd4];
	}

	function getSBRouxScramble(type, length, cases) {
		var rnd4 = rn(4);
		return getAnyScramble(0xfa9ff6ffffff, 0xf00ff0ffffff, 0xf65fffff, 0xf00fffff, 0, [rlpresuff[rnd4]]) + rlappsuff[rnd4];
	}

	function getCOLLImage(efill, cases, canvas) {
		var face = coll_map[cases][2].replace(/e/g, efill || 'U');
		if (!canvas) {
			return [face, null, cofilter[cases]];
		}
		image.llImage.drawImage(face, null, canvas);
	}

	function getZZLLScramble(type, length, cases, neut) {
		return getAnyScramble(0xba9876543f1f, 0x000000000000, 0x7654ffff, 0x0000ffff, neut, aufsuff);
	}

	var ttll_map = [
		[0x32410, 0x3210, 'FBar-1'],
		[0x32410, 0x3102, 'FBar-2'],
		[0x32410, 0x3021, 'FBar-3'],
		[0x32410, 0x2301, 'FBar-4'],
		[0x32410, 0x2130, 'FBar-5'],
		[0x32410, 0x2013, 'FBar-6'],
		[0x32410, 0x1320, 'FBar-7'],
		[0x32410, 0x1203, 'FBar-8'],
		[0x32410, 0x1032, 'FBar-9'],
		[0x32410, 0x0312, 'FBar-10'],
		[0x32410, 0x0231, 'FBar-11'],
		[0x32410, 0x0123, 'FBar-12'],
		[0x32401, 0x3201, '2Opp-1'],
		[0x32401, 0x3120, '2Opp-2'],
		[0x32401, 0x3012, '2Opp-3'],
		[0x32401, 0x2310, '2Opp-4'],
		[0x32401, 0x2103, '2Opp-5'],
		[0x32401, 0x2031, '2Opp-6'],
		[0x32401, 0x1302, '2Opp-7'],
		[0x32401, 0x1230, '2Opp-8'],
		[0x32401, 0x1023, '2Opp-9'],
		[0x32401, 0x0321, '2Opp-10'],
		[0x32401, 0x0213, '2Opp-11'],
		[0x32401, 0x0132, '2Opp-12'],
		[0x31420, 0x3201, 'ROpp-1'],
		[0x31420, 0x3120, 'ROpp-2'],
		[0x31420, 0x3012, 'ROpp-3'],
		[0x31420, 0x2310, 'ROpp-4'],
		[0x31420, 0x2103, 'ROpp-5'],
		[0x31420, 0x2031, 'ROpp-6'],
		[0x31420, 0x1302, 'ROpp-7'],
		[0x31420, 0x1230, 'ROpp-8'],
		[0x31420, 0x1023, 'ROpp-9'],
		[0x31420, 0x0321, 'ROpp-10'],
		[0x31420, 0x0213, 'ROpp-11'],
		[0x31420, 0x0132, 'ROpp-12'],
		[0x31402, 0x3210, 'RBar-1'],
		[0x31402, 0x3102, 'RBar-2'],
		[0x31402, 0x3021, 'RBar-3'],
		[0x31402, 0x2301, 'RBar-4'],
		[0x31402, 0x2130, 'RBar-5'],
		[0x31402, 0x2013, 'RBar-6'],
		[0x31402, 0x1320, 'RBar-7'],
		[0x31402, 0x1203, 'RBar-8'],
		[0x31402, 0x1032, 'RBar-9'],
		[0x31402, 0x0312, 'RBar-10'],
		[0x31402, 0x0231, 'RBar-11'],
		[0x31402, 0x0123, 'RBar-12'],
		[0x30421, 0x3210, '2Bar-1'],
		[0x30421, 0x3102, '2Bar-2'],
		[0x30421, 0x3021, '2Bar-3'],
		[0x30421, 0x2301, '2Bar-4'],
		[0x30421, 0x2130, '2Bar-5'],
		[0x30421, 0x2013, '2Bar-6'],
		[0x30421, 0x1320, '2Bar-7'],
		[0x30421, 0x1203, '2Bar-8'],
		[0x30421, 0x1032, '2Bar-9'],
		[0x30421, 0x0312, '2Bar-10'],
		[0x30421, 0x0231, '2Bar-11'],
		[0x30421, 0x0123, '2Bar-12'],
		[0x30412, 0x3201, 'FOpp-1'],
		[0x30412, 0x3120, 'FOpp-2'],
		[0x30412, 0x3012, 'FOpp-3'],
		[0x30412, 0x2310, 'FOpp-4'],
		[0x30412, 0x2103, 'FOpp-5'],
		[0x30412, 0x2031, 'FOpp-6'],
		[0x30412, 0x1302, 'FOpp-7'],
		[0x30412, 0x1230, 'FOpp-8'],
		[0x30412, 0x1023, 'FOpp-9'],
		[0x30412, 0x0321, 'FOpp-10'],
		[0x30412, 0x0213, 'FOpp-11'],
		[0x30412, 0x0132, 'FOpp-12']
	];
	var ttllprobs = [];
	var ttllfilter = [];
	for (var i = 0; i < ttll_map.length; i++) {
		ttllprobs[i] = 1;
		ttllfilter[i] = ttll_map[i][2];
	}

	function getTTLLScramble(type, length, cases, neut) {
		var ttllcase = ttll_map[scrMgr.fixCase(cases, ttllprobs)];
		return getAnyScramble(0xba9876540000 + ttllcase[1], 0x000000000000, 0x76500000 + ttllcase[0], 0x00000000, neut, aufsuff, aufsuff);
	}

	function getTTLLImage(cases, canvas) {
		var ret = [];
		var ttllcase = ttll_map[cases];
		for (var i = 3; i >= 0; i--) {
			ret.push(["FR", "LF", "BL", "RB", "GG"][ttllcase[0] >> (i * 4) & 0xf]);
			ret.push("RFLB".charAt(ttllcase[1] >> (i * 4) & 0xf));
		}
		ret = ret.join('');
		ret = ret.slice(7) + ret.slice(0, 7);
		var llParam = ['GDDDDDDDD' + ret, null]
		if (!canvas) {
			return llParam.concat([ttllfilter[cases]]);
		}
		image.llImage.drawImage(llParam[0], llParam[1], canvas);
	}

	function getLSEScramble() {
		var rnd4 = rn(4);
		return getAnyScramble(0xba98f6f4ffff, 0x0000f0f0ffff, 0x76543210, 0x00000000, 0, [rlpresuff[rnd4]], aufsuff) + rlappsuff[rnd4];
	}

	function getCLLScramble(type, length, cases, neut) {
		var cocase = coll_map[scrMgr.fixCase(cases, coprobs)];
		return getAnyScramble(0xba987654ffff, 0x00000000ffff, cocase[0] + 0x76540000, cocase[1], neut, aufsuff, aufsuff);
	}

	function getELLScramble(type, length, cases, neut) {
		return getAnyScramble(0xba987654ffff, 0x00000000ffff, 0x76543210, 0x00000000, neut);
	}

	function get2GLLScramble(type, length, cases, neut) {
		return getAnyScramble(0xba987654ffff, 0x000000000000, 0x76543210, 0x0000ffff, neut, aufsuff);
	}

	var pll_map = [
		[0x1032, 0x3210, 1, 'H'],
		[0x3102, 0x3210, 4, 'Ua'],
		[0x3021, 0x3210, 4, 'Ub'],
		[0x2301, 0x3210, 2, 'Z'],
		[0x3210, 0x3021, 4, 'Aa'],
		[0x3210, 0x3102, 4, 'Ab'],
		[0x3210, 0x2301, 2, 'E'],
		[0x3012, 0x3201, 4, 'F'],
		[0x2130, 0x3021, 4, 'Ga'],
		[0x1320, 0x3102, 4, 'Gb'],
		[0x3021, 0x3102, 4, 'Gc'],
		[0x3102, 0x3021, 4, 'Gd'],
		[0x3201, 0x3201, 4, 'Ja'],
		[0x3120, 0x3201, 4, 'Jb'],
		[0x1230, 0x3012, 1, 'Na'],
		[0x3012, 0x3012, 1, 'Nb'],
		[0x0213, 0x3201, 4, 'Ra'],
		[0x2310, 0x3201, 4, 'Rb'],
		[0x1230, 0x3201, 4, 'T'],
		[0x3120, 0x3012, 4, 'V'],
		[0x3201, 0x3012, 4, 'Y']
	];
	var pllprobs = mathlib.idxArray(pll_map, 2);
	var pllfilter = mathlib.idxArray(pll_map, 3);
	var pllImgParam = [
		['BFBRLRFBFLRL', [1, 7], [3, 5]],
		['BRBRLRFFFLBL', [3, 7], [7, 5], [5, 3]],
		['BLBRBRFFFLRL', [3, 5], [5, 7], [7, 3]],
		['LFLBRBRBRFLF', [1, 5], [3, 7]],
		['LBBRRLBFRFLF', [0, 2], [2, 6], [6, 0]],
		['RBFLRRFFLBLB', [0, 6], [6, 8], [8, 0]],
		['LBRFRBRFLBLF', [0, 6], [2, 8]],
		['BFRFRBRBFLLL', [1, 7], [2, 8]],
		['BRRFLBRBFLFL'],
		['BFRFBBRLFLRL'],
		['BFRFLBRRFLBL'],
		['BLRFFBRBFLRL'],
		['BBRFFBRRFLLL', [1, 5], [2, 8]],
		['LBBRLLBRRFFF', [2, 8], [5, 7]],
		['FBBRLLBFFLRR', [2, 6], [3, 5]],
		['BBFLLRFFBRRL', [0, 8], [3, 5]],
		['LLBRBLBFRFRF', [1, 3], [2, 8]],
		['RBFLFRFLLBRB', [2, 8], [3, 7]],
		['BBRFLBRFFLRL', [2, 8], [3, 5]],
		['BBFLFRFRBRLL', [0, 8], [1, 5]],
		['BBFLRRFLBRFL', [0, 8], [1, 3]]
	];

	function getPLLScramble(type, length, cases, neut) {
		var pllcase = pll_map[scrMgr.fixCase(cases, pllprobs)];
		return getAnyScramble(pllcase[0] + 0xba9876540000, 0x000000000000, pllcase[1] + 0x76540000, 0x00000000, neut, aufsuff, aufsuff);
	}

	function getPLLImage(cases, canvas) {
		var arrows = pllImgParam[cases].slice(1);
		if (arrows.length == 2) {
			arrows = arrows.concat([[arrows[0][1], arrows[0][0]], [arrows[1][1], arrows[1][0]]])
		}
		var llParam = ['DDDDDDDDD' + pllImgParam[cases][0], arrows]
		if (!canvas) {
			return llParam.concat([pllfilter[cases]]);
		}
		image.llImage.drawImage(llParam[0], llParam[1], canvas);
	}

	var oll_map = [
		[0x0000, 0x0000, 1, 'PLL', 0x000ff],
		[0x1111, 0x1212, 2, 'Point-1', 0xeba00],
		[0x1111, 0x1122, 4, 'Point-2', 0xdda00],
		[0x1111, 0x0222, 4, 'Point-3', 0x5b620],
		[0x1111, 0x0111, 4, 'Point-4', 0x6d380],
		[0x0011, 0x2022, 4, 'Square-5', 0x8360b],
		[0x0011, 0x1011, 4, 'Square-6', 0x60b16],
		[0x0011, 0x2202, 4, 'SLBS-7', 0x1362a],
		[0x0011, 0x0111, 4, 'SLBS-8', 0x64392],
		[0x0011, 0x1110, 4, 'Fish-9', 0x2538a],
		[0x0011, 0x2220, 4, 'Fish-10', 0x9944c],
		[0x0011, 0x0222, 4, 'SLBS-11', 0x9160e],
		[0x0011, 0x1101, 4, 'SLBS-12', 0x44b13],
		[0x0101, 0x2022, 4, 'Knight-13', 0x1a638],
		[0x0101, 0x0111, 4, 'Knight-14', 0x2c398],
		[0x0101, 0x0222, 4, 'Knight-15', 0x8a619],
		[0x0101, 0x1011, 4, 'Knight-16', 0x28b1c],
		[0x1111, 0x0102, 4, 'Point-17', 0x4b381],
		[0x1111, 0x0012, 4, 'Point-18', 0x49705],
		[0x1111, 0x0021, 4, 'Point-19', 0xc9a05],
		[0x1111, 0x0000, 1, 'CO-20', 0x492a5],
		[0x0000, 0x1212, 2, 'OCLL-21', 0x1455a],
		[0x0000, 0x1122, 4, 'OCLL-22', 0xa445a],
		[0x0000, 0x0012, 4, 'OCLL-23', 0x140fa],
		[0x0000, 0x0021, 4, 'OCLL-24', 0x101de],
		[0x0000, 0x0102, 4, 'OCLL-25', 0x2047e],
		[0x0000, 0x0111, 4, 'OCLL-26', 0x2095e],
		[0x0000, 0x0222, 4, 'OCLL-27', 0x1247a],
		[0x0011, 0x0000, 4, 'CO-28', 0x012af],
		[0x0011, 0x0210, 4, 'Awkward-29', 0x1138e],
		[0x0011, 0x2100, 4, 'Awkward-30', 0x232aa],
		[0x0011, 0x0021, 4, 'P-31', 0x50396],
		[0x0011, 0x1002, 4, 'P-32', 0x0562b],
		[0x0101, 0x0021, 4, 'T-33', 0x1839c],
		[0x0101, 0x0210, 4, 'C-34', 0x2a2b8],
		[0x0011, 0x1020, 4, 'Fish-35', 0x4a1d1],
		[0x0011, 0x0102, 4, 'W-36', 0xc4293],
		[0x0011, 0x2010, 4, 'Fish-37', 0x0338b],
		[0x0011, 0x0201, 4, 'W-38', 0x11a2e],
		[0x0101, 0x1020, 4, 'BLBS-39', 0x18a3c],
		[0x0101, 0x0102, 4, 'BLBS-40', 0x8c299],
		[0x0011, 0x1200, 4, 'Awkward-41', 0x152aa],
		[0x0011, 0x0120, 4, 'Awkward-42', 0x0954d],
		[0x0011, 0x0012, 4, 'P-43', 0xe0296],
		[0x0011, 0x2001, 4, 'P-44', 0x03a2b],
		[0x0101, 0x0012, 4, 'T-45', 0xa829c],
		[0x0101, 0x0120, 4, 'C-46', 0x43863],
		[0x0011, 0x1221, 4, 'L-47', 0x52b12],
		[0x0011, 0x1122, 4, 'L-48', 0xa560a],
		[0x0011, 0x2112, 4, 'L-49', 0xe4612],
		[0x0011, 0x2211, 4, 'L-50', 0xec450],
		[0x0101, 0x1221, 4, 'I-51', 0x1ab18],
		[0x0101, 0x1122, 4, 'I-52', 0x53942],
		[0x0011, 0x2121, 4, 'L-53', 0x54712],
		[0x0011, 0x1212, 4, 'L-54', 0x1570a],
		[0x0101, 0x2121, 2, 'I-55', 0x1c718],
		[0x0101, 0x1212, 2, 'I-56', 0xaaa18],
		[0x0101, 0x0000, 2, 'CO-57', 0x082bd]
	];
	var ollprobs = mathlib.idxArray(oll_map, 2);
	var ollfilter = mathlib.idxArray(oll_map, 3);

	function getOLLScramble(type, length, cases, neut) {
		var ollcase = oll_map[scrMgr.fixCase(cases, ollprobs)];
		return getAnyScramble(0xba987654ffff, ollcase[0], 0x7654ffff, ollcase[1], neut, aufsuff, aufsuff);
	}

	function getOLLImage(cases, canvas) {
		var face = '';
		var val = oll_map[cases][4];
		for (var i = 0; i < 21; i++) {
			if (i == 4) {
				face += 'D';
			} else {
				face += (val & 1) ? 'D' : 'G';
				val >>= 1;
			}
		}
		if (!canvas) {
			return [face, null, ollfilter[cases]];
		}
		image.llImage.drawImage(face, null, canvas);
	}

	function getEOLineScramble(type, length, cases, neut) {
		return getAnyScramble(0xffff7f5fffff, 0x000000000000, 0xffffffff, 0xffffffff, neut);
	}

	function getEOCrossScramble(type, length, cases, neut) {
		return getAnyScramble(0xffff7654ffff, 0x000000000000, 0xffffffff, 0xffffffff, neut);
	}

	var daufsuff = [[], [Dx1], [Dx2], [Dx3]];
	var udaufsuff = [];
	for (var i = 0; i < 16; i++) {
		udaufsuff.push(aufsuff[i >> 2].concat(daufsuff[i & 3]));
	}
	var daufrot = ["", "y", "y2", "y'"];
	function getMehta3QBScramble() {
		var rnd4 = mathlib.rn(4);
		return getAnyScramble(0xffff765fffff, 0xffff000fffff, 0xf65fffff, 0xf00fffff, 0, [daufsuff[rnd4]]) + daufrot[rnd4];
	}

	function getMehtaEOLEScramble() {
		var skip = mathlib.rn(4);
		var rnd4 = mathlib.rn(4);
		return getAnyScramble(0xba98765fffff + (0x4567 & (0xf << skip * 4)) * 0x100000000, 0x0000000fffff + (0xf << skip * 4) * 0x100000000, 0xf65fffff, 0xf00fffff, 0, [daufsuff[rnd4]]) + daufrot[rnd4];
	}

	function getMehtaTDRScramble() {
		return getAnyScramble(0xba98765fffff, 0x000000000000, 0xf65fffff, 0xf00fffff);
	}

	function getMehta6CPScramble() {
		return getAnyScramble(0xba98765fffff, 0x000000000000, 0xf65fffff, 0x00000000);
	}

	function getMehtaL5EPScramble() {
		return getAnyScramble(0xba98765fffff, 0x000000000000, 0x76543210, 0x00000000);
	}

	function getMehtaCDRLLScramble() {
		return getAnyScramble(0xba98765fffff, 0x000000000000, 0x7654ffff, 0x0000ffff);
	}

	var customfilter = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'RF', 'LF', 'LB', 'RB', 'URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
	for (var i = 0; i < 20; i++) {
		var piece = customfilter[i];
		customfilter[i + 20] = (piece.length == 2 ? 'OriE-' : 'OriC-') + piece;
		customfilter[i] = (piece.length == 2 ? 'PermE-' : 'PermC-') + piece;
	}
	var customprobs = mathlib.valuedArray(40, 0);

	function getCustomScramble(type, length, cases, neut) {
		var ep = 0;
		var eo = 0;
		var cp = 0;
		var co = 0;
		var chk = 0x1100; //ep+cp|ep+1|cp+1|eo|co
		cases = cases || mathlib.valuedArray(40, 1);
		for (var i = 0; i < 12; i++) {
			chk += (cases[i] ? 0x11000 : 0) + (cases[i + 20] ? 0x10 : 0);
			ep += (cases[i] ? 0xf : i) * Math.pow(16, i);
			eo += (cases[i + 20] ? 0xf : 0) * Math.pow(16, i);
		}
		for (var i = 0; i < 8; i++) {
			chk += (cases[i + 12] ? 0x10100 : 0) + (cases[i + 32] ? 0x1 : 0);
			cp += (cases[i + 12] ? 0xf : i) * Math.pow(16, i);
			co += (cases[i + 32] ? 0xf : 0) * Math.pow(16, i);
		}
		if ((chk & 0x1cccee) == 0) {
			return "U' U ";
		}
		return getAnyScramble(ep, eo, cp, co, neut);
	}

	function getEasyCrossScramble(type, length, _, neut) {
		var cases = cross.getEasyCross(length);
		return getAnyScramble(cases[0], cases[1], 0xffffffff, 0xffffffff, neut);
	}

	function getEasyXCrossScramble(type, length, _, neut) {
		var cases = cross.getEasyXCross(length);
		return getAnyScramble(cases[0], cases[1], cases[2], cases[3], neut);
	}

	var normTrans = [];

	function normOrient(facelet, toAppend) {
		var rotMoves1 = ["", "x", "x2", "x'", "z", "z'"];
		var rotMoves2 = ["", "y", "y2", "y'"];
		if (normTrans.length == 0) {
			for (var i = 0; i < 24; i++) {
				var cc = new mathlib.CubieCube();
				cc.selfMoveStr(rotMoves2[i & 3]);
				cc.selfMoveStr(rotMoves1[i >> 2]);
				normTrans.push(cc.toPerm(null, null, null, true));
			}
		}
		var ori = 0;
		out: for (var i = 0; i < 24; i++) {
			for (var j = 0; j < 6; j++) {
				if (facelet[normTrans[i][j * 9 + 4]] != "URFDLB".charAt(j)) {
					continue out;
				}
			}
			var ret = [];
			for (var j = 0; j < 54; j++) {
				ret[j] = facelet[normTrans[i][j]];
			}
			facelet = ret.join('');
			ori = i;
			break;
		}
		var mv1 = rotMoves1[ori >> 2];
		if (mv1 != "") {
			toAppend.push(mv1[0] + "'2 ".charAt("2'".indexOf(mv1[1]) + 1));
		}
		var mv2 = rotMoves2[ori & 3];
		if (mv2 != "") {
			toAppend.push(mv2[0] + "'2 ".charAt("2'".indexOf(mv2[1]) + 1));
		}
		return facelet;
	}

	var subsetSolvs = {};

	function subsetScramble(moves) {
		var key = moves.join('|');
		if (!subsetSolvs[key]) {
			var gens = [];
			for (var m = 0; m < moves.length; m++) {
				var cc = new mathlib.CubieCube();
				cc.selfMoveStr(moves[m]);
				gens.push(cc.toPerm(null, null, null, true));
			}
			subsetSolvs[key] = new grouplib.SubgroupSolver(gens);
			subsetSolvs[key].initTables();
		}
		var solv = subsetSolvs[key];
		var solution = "";
		if (solv.sgsG.size() < 1e8) {
			do {
				var state = subsetSolvs[key].sgsG.rndElem();
				var sol = subsetSolvs[key].DissectionSolve(state, 12, 20);
				solution = sol.map((mvpow) => moves[mvpow[0]] + ["", "2", "'"][mvpow[1] - 1]).join(" ");
			} while (solution.length <= 2);
			return solution.replace(/ +/g, ' ');
		}
		var toAppend;
		do {
			var state = subsetSolvs[key].sgsG.rndElem();
			for (var i = 0; i < state.length; i++) {
				state[i] = "URFDLB".charAt(~~(state[i] / 9));
			}
			toAppend = [];
			state = normOrient(state.join(''), toAppend);
			solution = search.solution(state, 21, 1e9, 50, 2);
		} while (solution.length <= 3);
		toAppend.unshift(solution);
		return toAppend.join(' ').replace(/ +/g, ' ');
	}

	function genFacelet(facelet) {
		return search.solution(facelet, 21, 1e9, 50, 2);
	}

	function solvFacelet(facelet) {
		return search.solution(facelet, 21, 1e9, 50, 0);
	}

	/*

	// gens: pattern (string) or [perm1, perm2, ...]
	// assert <iniGens> >= <endGens> <> {e}
	function CommonStep(iniGens, endGens, imgInfo, names) {
		this.iniGens = iniGens;
		this.endGens = endGens;
		this.imgInfo = imgInfo;
		this.names = names || [];
	}

	CommonStep.prototype.init = function() {
		if (this.iniG) {
			return;
		}
		this.iniG = $.isArray(this.iniGens) ? new grouplib.SchreierSims(this.iniGens) : pat3x3.genPatternGroup(this.iniGens);
		this.endG = $.isArray(this.endGens) ? new grouplib.SchreierSims(this.endGens) : pat3x3.genPatternGroup(this.endGens);
		var genAUF = mathlib.CubieCube.moveCube[0].toPerm();
		this.endG.extend([genAUF]);
		this.iniG.extend([genAUF]);
		var cosets = this.iniG.listCoset(this.endG);
		var probs = [];
		for (var i = 0; i < cosets.length; i++) {
			cosets[i] = this.endG.minElem(grouplib.permInv(cosets[i]));
		}
		cosets.sort(grouplib.permCmp);
		var visited = new Set();
		this.movePerm = [];
		var uniqCosets = [];
		for (var i = 0; i < cosets.length; i++) { // handle <U> equivalence
			var coset = cosets[i];
			if (visited.has(coset.join(','))) {
				continue;
			}
			visited.add(coset.join(','));
			var idx = uniqCosets.length;
			this.names[idx] = this.names[idx] || (idx + 1 + "");
			probs[idx] = 1;
			uniqCosets.push(coset);
			for (var m = 0; m < 3; m++) {
				this.movePerm[m] = this.movePerm[m] || mathlib.CubieCube.moveCube[m].toPerm();
				var key = this.endG.minElem(grouplib.permMult(this.movePerm[m], coset)).join(',');
				if (!visited.has(key)) {
					visited.add(key);
					probs[idx]++;
				}
			}
		}
		this.cosets = uniqCosets;
		this.probs = probs;
		DEBUG && console.log('[scramble_333] common step filter init', this);
	}

	CommonStep.prototype.getScramble = function(type, length, cases, neut) { // currently not support neut
		this.init();
		var caze = scrMgr.fixCase(cases, this.probs);
		var perm = grouplib.permMult(this.cosets[caze], this.endG.rndElem());
		var auf = mathlib.rn(4);
		if (auf != 3) {
			perm = grouplib.permMult(this.movePerm[auf], perm);
		}
		var posit = "";
		for (var i = 0; i < perm.length; i++) {
			posit += mathlib.SOLVED_FACELET.charAt(perm[i]);
		}
		return search.solution(posit, 21, 1e9, 50, 2);
	}

	CommonStep.prototype.getImage = function(caze, canvas) {
		this.init();
		var perm = this.cosets[caze];
		var posit = "";
		var llIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 18, 19, 20, 9, 10, 11, 45, 46, 47, 36, 37, 38];
		var target = "DDDDDDDDDLLLLLLLLLFFFFFFFFFUUUUUUUUURRRRRRRRRBBBBBBBBB";
		if (this.imgInfo) {
			target = this.imgInfo[1];
		} else if (!$.isArray(this.endGens)) {
			target = this.endGens;
		}
		for (var i = 0; i < llIdx.length; i++) {
			posit += target.charAt(perm[llIdx[i]]);
		}
		if (!canvas) {
			return [posit, null, this.names[caze]];
		}
		image.llImage.drawImage(posit, null, canvas);
	}

	CommonStep.prototype.regScr = function(type) {
		scrMgr.reg(type, this.getScramble.bind(this), this.getExtra.bind(this));
	}

	CommonStep.prototype.getExtra = function(idx) {
		this.init();
		return [this.names, this.probs, this.getImage.bind(this)][idx];
	}

	var CLL_SOLVED = "DGDGDGDGDLGLLLLLLLFGFFFFFFFUUUUUUUUURGRRRRRRRBGBBBBBBB";
	var F2L_SOLVED = "GGGGDGGGGGGGLLLLLLGGGFFFFFFUUUUUUUUUGGGRRRRRRGGGBBBBBB";
	new CommonStep(F2L_SOLVED, CLL_SOLVED).regScr('cll');
	*/

	scrMgr.reg('333', getRandomScramble)
		('333fm', getFMCScramble)
		('edges', getEdgeScramble)
		('corners', getCornerScramble)
		('333custom', getCustomScramble, [customfilter, customprobs])
		('ll', getLLScramble)
		('lsll2', getLSLLScramble, [f2lfilter, f2lprobs, getF2LImage.bind(null, 'GGGGDGGGGGGGGRRGRRGGGBBGBBG', f2l_map, f2lprobs)])
		('f2l', getF2LScramble)
		('zbll', getZBLLScramble, [zbfilter, zbprobs, getZBLLImage])
		('zbllx2', getZBLLx2Scramble, [zbfilter, zbprobs, getZBLLImage])
		('zzll', getZZLLScramble)
		('zbls', getLSLLScramble, [f2lfilter, f2lprobs, getF2LImage.bind(null, 'GGGGDGGGGGGGGRRGRRGGGBBGBBG', f2l_map, f2lprobs)])
		('ttll', getTTLLScramble, [ttllfilter, ttllprobs, getTTLLImage])
		('eols', getEOLSScramble, [eolsfilter, eolsprobs, getF2LImage.bind(null, 'GDGDDDGDGGGGGRRGRRGGGBBDBBG', eols_map, eolsprobs)])
		('wvls', getWVLSScramble, [wvlsfilter, wvlsprobs, getWVLSImage])
		('vls', getVLSScramble, [vlsfilter, vlsprobs, getVLSImage])
		('lse', getLSEScramble)
		('cmll', getCMLLScramble, [cofilter, coprobs, getCOLLImage.bind(null, 'G')])
		('cll', getCLLScramble, [cofilter, coprobs, getCOLLImage.bind(null, 'G')])
		('coll', getCOLLScramble, [cofilter, coprobs, getCOLLImage.bind(null, 'D')])
		('ell', getELLScramble)
		('pll', getPLLScramble, [pllfilter, pllprobs, getPLLImage])
		('oll', getOLLScramble, [ollfilter, ollprobs, getOLLImage])
		('2gll', get2GLLScramble)
		('sbrx', getSBRouxScramble)
		('half', subsetScramble.bind(null, ["U2", "R2", "F2", "D2", "L2", "B2"]))
		('333drud', subsetScramble.bind(null, ["U", "R2", "F2", "D", "L2", "B2"]))
		('3gen_F', subsetScramble.bind(null, ["U", "R", "F"]))
		('3gen_L', subsetScramble.bind(null, ["U", "R", "L"]))
		('2gen', subsetScramble.bind(null, ["U", "R"]))
		('2genl', subsetScramble.bind(null, ["U", "L"]))
		('RrU', subsetScramble.bind(null, ["R", "Rw", "U"]))
		('roux', subsetScramble.bind(null, ["M", "U"]))
		('mt3qb', getMehta3QBScramble)
		('mteole', getMehtaEOLEScramble)
		('mttdr', getMehtaTDRScramble)
		('mt6cp', getMehta6CPScramble)
		('mtl5ep', getMehtaL5EPScramble)
		('mtcdrll', getMehtaCDRLLScramble)
		('easyc', getEasyCrossScramble)
		('easyxc', getEasyXCrossScramble)
		('eoline', getEOLineScramble)
		('eocross', getEOCrossScramble);

	return {
		/* mark2 interface */
		getRandomScramble: getRandomScramble, //getRandomScramble,

		/* added methods */
		getEdgeScramble: getEdgeScramble,
		getCornerScramble: getCornerScramble,
		getLLScramble: getLLScramble,
		getLSLLScramble: getLSLLScramble,
		getCOLLScramble: getCOLLScramble,
		getZBLLScramble: getZBLLScramble,
		getZBLLx2Scramble: getZBLLx2Scramble,
		getZZLLScramble: getZZLLScramble,
		getTTLLScramble: getTTLLScramble,
		getF2LScramble: getF2LScramble,
		getLSEScramble: getLSEScramble,
		getCMLLScramble: getCMLLScramble,
		getCLLScramble: getCLLScramble,
		getELLScramble: getELLScramble,
		getAnyScramble: getAnyScramble,
		getPLLImage: getPLLImage,
		getOLLImage: getOLLImage,
		getCOLLImage: getCOLLImage,
		getZBLLImage: getZBLLImage,
		genFacelet: genFacelet,
		solvFacelet: solvFacelet
	};

})(mathlib.getNPerm, mathlib.setNPerm, mathlib.getNParity, mathlib.rn, mathlib.rndEl);

"use strict";

var scramble_444 = (function(Cnk, circle) {

	var PHASE1_SOLS = 10000;
	var PHASE2_ATTS = 500;
	var PHASE2_SOLS = 100;
	var MAX_SEARCH_DEPTH = 60;

	function createArray(length1, length2) {
		var result, i;
		result = new Array(length1);
		if (length2 != undefined) {
			for (i = 0; i < length1; i++) {
				result[i] = new Array(length2);
			}
		}
		return result;
	}

	var _;

	function defineClass() {
		_ = arguments[0].prototype;
		for (var i = 1; i < arguments.length; ++i) {
			arguments[i].prototype = _;
		}
	}

	function nullMethod() {}

	function $clinit_Center1() {
		$clinit_Center1 = nullMethod;
		Center1SymMove = createArray(15582, 36);
		Center1Sym2Raw = createArray(15582);
		Center1SymPrun = createArray(15582);
		SymMult = createArray(48, 48);
		SymMove = createArray(48, 36);
		SymInv = createArray(48);
		finish_0 = createArray(48);
	}

	function $equals(obj, c) {
		for (var i = 0; i < 24; ++i) {
			if (obj.ct[i] != c.ct[i]) {
				return false;
			}
		}
		return true;
	}

	function $get_1(obj) {
		var idx = 0;
		var r = 8;
		for (var i = 23; i >= 0; --i) {
			obj.ct[i] == 1 && (idx += Cnk[i][r--]);
		}
		return idx;
	}

	function getCenter1RotThres(obj, rotPerm, thres) {
		var idx = 0;
		var r = 8;
		for (var i = 23; i >= 0; --i) {
			obj.ct[rotPerm[i]] == 1 && (idx += Cnk[i][r--]);
			if (idx >= thres) {
				return -1;
			}
		}
		return idx;
	}

	function $getsym(obj) {
		var cord, j;
		var ret = 0;
		if (Center1Raw2Sym != null) {
			for (var s = 0; s < 48; s++) {
				var idx = getCenter1RotThres(obj, Center1RotPerm[s], mathlib.Cnk[21][8]);
				if (idx != -1) {
					ret = Center1Raw2Sym[idx];
					return ret & ~0x3f | SymMult[s][ret & 0x3f];
				}
			}
		}
		for (j = 0; j < 48; ++j) {
			cord = raw2sym_0($get_1(obj));
			if (cord != -1) {
				return cord * 64 + j;
			}
			$rot(obj, 0);
			j % 2 == 1 && $rot(obj, 1);
			j % 8 == 7 && $rot(obj, 2);
			j % 16 == 15 && $rot(obj, 3);
		}
	}

	function doMoveCenter1(obj, m_0) {
		doMoveCenterCube(obj, m_0);
	}

	function $rot(obj, r) {
		switch (r) {
			case 0:
				doMoveCenter1(obj, 19);
				doMoveCenter1(obj, 28);
				break;
			case 1:
				doMoveCenter1(obj, 21);
				doMoveCenter1(obj, 32);
				break;
			case 2:
				swap(obj.ct, 0, 3, 1, 2, 1);
				swap(obj.ct, 8, 11, 9, 10, 1);
				swap(obj.ct, 4, 7, 5, 6, 1);
				swap(obj.ct, 12, 15, 13, 14, 1);
				swap(obj.ct, 16, 19, 21, 22, 1);
				swap(obj.ct, 17, 18, 20, 23, 1);
				break;
			case 3:
				doMoveCenter1(obj, 18);
				doMoveCenter1(obj, 29);
				doMoveCenter1(obj, 24);
				doMoveCenter1(obj, 35);
				break;
		}
	}

	function Center1Rotate(obj, r) {
		var j;
		for (j = 0; j < r; ++j) {
			$rot(obj, 0);
			j % 2 == 1 && $rot(obj, 1);
			j % 8 == 7 && $rot(obj, 2);
			j % 16 == 15 && $rot(obj, 3);
		}
	}

	function $set_0(obj, idx) {
		var i, r;
		r = 8;
		for (i = 23; i >= 0; --i) {
			obj.ct[i] = 0;
			if (idx >= Cnk[i][r]) {
				idx -= Cnk[i][r--];
				obj.ct[i] = 1;
			}
		}
	}

	function $set_1(obj, c) {
		var i;
		for (i = 0; i < 24; ++i) {
			obj.ct[i] = c.ct[i];
		}
	}

	function Center1(cc) {
		if (cc) {
			this.ct = cc.ct.slice();
			return;
		}
		this.ct = [];
		for (var i = 0; i < 24; ++i) {
			this.ct[i] = i < 8 ? 1 : 0;
		}
	}

	Center1.prototype.fromCube = function(cc, urf) {
		for (var i = 0; i < 24; ++i) {
			this.ct[i] = cc.ct[i] % 3 == urf ? 1 : 0;
		}
		return this;
	}

	function initCenter1MoveTable() {
		var c = new Center1();
		var d = new Center1();
		for (var i = 0; i < 15582; ++i) {
			$set_0(d, Center1Sym2Raw[i]);
			for (var m = 0; m < 36; ++m) {
				if (m % 3 == 1 || Center1SymMove[i][m] !== undefined) {
					continue;
				}
				$set_1(c, d);
				doMoveCenter1(c, m);
				var idx = $getsym(c);
				Center1SymMove[i][m] = idx;
				var invM = SymMove[idx & 0x3f][~~(m / 3) * 3 + 2 - m % 3];
				if (Center1SymMove[idx >> 6][invM] === undefined) {
					Center1SymMove[idx >> 6][invM] = i << 6 | SymInv[idx & 0x3f];
				}
			}
		}
		for (var i = 0; i < 15582; i++) {
			for (var m = 0; m < 36; m += 3) {
				var idx = Center1SymMove[i][m];
				var nextM = SymMove[idx & 0x3f][m];
				var nextIdx = Center1SymMove[idx >>> 6][nextM];
				var symx = SymMult[idx & 0x3f][nextIdx & 0x3f];
				Center1SymMove[i][m + 1] = nextIdx & ~0x3f | symx;
			}
		}
	}

	function initCenter1Prun() {
		var check, depth, done, i, idx, inv, m_0, select;
		fill_0(Center1SymPrun);
		Center1SymPrun[0] = 0;
		depth = 0;
		done = 1;
		while (done != 15582) {
			inv = depth > 4;
			select = inv ? -1 : depth;
			check = inv ? depth : -1;
			++depth;
			for (i = 0; i < 15582; ++i) {
				if (Center1SymPrun[i] != select) {
					continue;
				}
				for (m_0 = 0; m_0 < 27; ++m_0) {
					idx = Center1SymMove[i][m_0] >>> 6;
					if (Center1SymPrun[idx] != check) {
						continue;
					}
					++done;
					if (inv) {
						Center1SymPrun[i] = depth;
						break;
					} else {
						Center1SymPrun[idx] = depth;
					}
				}
			}
		}
	}

	function getSolvedSym(cube) {
		var c, check, i, j;
		c = new Center1(cube);
		for (j = 0; j < 48; ++j) {
			check = true;
			for (i = 0; i < 24; ++i) {
				if (c.ct[i] != (centerFacelet[i] >> 4)) {
					check = false;
					break;
				}
			}
			if (check) {
				return j;
			}
			$rot(c, 0);
			j % 2 == 1 && $rot(c, 1);
			j % 8 == 7 && $rot(c, 2);
			j % 16 == 15 && $rot(c, 3);
		}
		return -1;
	}

	function initSymMeta() {
		var c, d, e, f, i, j, k_0;
		c = new Center1();
		for (i = 0; i < 24; ++i) {
			c.ct[i] = i;
		}
		d = new Center1(c);
		e = new Center1(c);
		f = new Center1(c);
		for (i = 0; i < 48; ++i) {
			for (j = 0; j < 48; ++j) {
				for (k_0 = 0; k_0 < 48; ++k_0) {
					if ($equals(c, d)) {
						SymMult[i][j] = k_0;
						k_0 == 0 && (SymInv[i] = j);
					}
					$rot(d, 0);
					k_0 % 2 == 1 && $rot(d, 1);
					k_0 % 8 == 7 && $rot(d, 2);
					k_0 % 16 == 15 && $rot(d, 3);
				}
				$rot(c, 0);
				j % 2 == 1 && $rot(c, 1);
				j % 8 == 7 && $rot(c, 2);
				j % 16 == 15 && $rot(c, 3);
			}
			$rot(c, 0);
			i % 2 == 1 && $rot(c, 1);
			i % 8 == 7 && $rot(c, 2);
			i % 16 == 15 && $rot(c, 3);
		}
		for (i = 0; i < 48; ++i) {
			$set_1(c, e);
			Center1Rotate(c, SymInv[i]);
			for (j = 0; j < 36; ++j) {
				$set_1(d, c);
				doMoveCenter1(d, j);
				Center1Rotate(d, i);
				for (k_0 = 0; k_0 < 36; ++k_0) {
					$set_1(f, e);
					doMoveCenter1(f, k_0);
					if ($equals(f, d)) {
						SymMove[i][j] = k_0;
						break;
					}
				}
			}
		}
		$set_0(c, 0);
		for (i = 0; i < 48; ++i) {
			finish_0[SymInv[i]] = $get_1(c);
			$rot(c, 0);
			i % 2 == 1 && $rot(c, 1);
			i % 8 == 7 && $rot(c, 2);
			i % 16 == 15 && $rot(c, 3);
		}
	}

	function initCenter1Sym2Raw() {
		var idx, j, occ;
		var c = new Center1();
		var d = new Center1();

		Center1RotPerm = [];
		for (var i = 0; i < 24; i++) {
			c.ct[i] = i;
		}
		for (var s = 0; s < 48; s++) {
			Center1RotPerm[s] = c.ct.slice();
			$rot(c, 0);
			s % 2 == 1 && $rot(c, 1);
			s % 8 == 7 && $rot(c, 2);
			s % 16 == 15 && $rot(c, 3);
		}

		occ = createArray(22984);
		for (var i = 0; i < 22984; i++) {
			occ[i] = 0;
		}
		var count = 0;
		for (var i = 0; i < mathlib.Cnk[21][8]; ++i) {
			if ((occ[i >>> 5] & 1 << (i & 31)) == 0) {
				$set_0(c, i);
				for (j = 0; j < 48; ++j) {
					idx = getCenter1RotThres(c, Center1RotPerm[j], mathlib.Cnk[21][8]);
					if (idx == -1) {
						continue;
					}
					occ[idx >>> 5] |= 1 << (idx & 31);
					Center1Raw2Sym != null && (Center1Raw2Sym[idx] = count << 6 | SymInv[j]);
				}
				Center1Sym2Raw[count++] = i;
			}
		}
	}

	function raw2sym_0(n) {
		var m_0;
		m_0 = binarySearch_0(Center1Sym2Raw, n);
		return m_0 >= 0 ? m_0 : -1;
	}

	var Center1SymPrun, Center1SymMove, finish_0, Center1Raw2Sym = null,
		Center1Sym2Raw, Center1RotPerm, SymInv, SymMove, SymMult;

	function $clinit_Center2() {
		$clinit_Center2 = nullMethod;
		rlmv = createArray(70, 28);
		ctmv = createArray(6435, 28);
		rlrot = createArray(70, 16);
		ctrot = createArray(6435, 16);
		ctprun = createArray(450450);
		pmv = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0];
	}

	function $getct(obj) {
		var i, idx, r;
		idx = 0;
		r = 8;
		for (i = 14; i >= 0; --i) {
			obj.ct[i] != obj.ct[15] && (idx += Cnk[i][r--]);
		}
		return idx;
	}

	function $getrl(obj) {
		var i, idx, r;
		idx = 0;
		r = 4;
		for (i = 6; i >= 0; --i) {
			obj.rl[i] != obj.rl[7] && (idx += Cnk[i][r--]);
		}
		return idx * 2 + obj.parity;
	}

	function doMoveCenter2(obj, m_0) {
		var key;
		obj.parity ^= pmv[m_0];
		key = m_0 % 3;
		m_0 = ~~(m_0 / 3);
		switch (m_0) {
			case 0:
				swap(obj.ct, 0, 1, 2, 3, key);
				break;
			case 1:
				swap(obj.rl, 0, 1, 2, 3, key);
				break;
			case 2:
				swap(obj.ct, 8, 9, 10, 11, key);
				break;
			case 3:
				swap(obj.ct, 4, 5, 6, 7, key);
				break;
			case 4:
				swap(obj.rl, 4, 5, 6, 7, key);
				break;
			case 5:
				swap(obj.ct, 12, 13, 14, 15, key);
				break;
			case 6:
				swap(obj.ct, 0, 1, 2, 3, key);
				swap(obj.rl, 0, 5, 4, 1, key);
				swap(obj.ct, 8, 9, 12, 13, key);
				break;
			case 7:
				swap(obj.rl, 0, 1, 2, 3, key);
				swap(obj.ct, 1, 15, 5, 9, key);
				swap(obj.ct, 2, 12, 6, 10, key);
				break;
			case 8:
				swap(obj.ct, 8, 9, 10, 11, key);
				swap(obj.rl, 0, 3, 6, 5, key);
				swap(obj.ct, 3, 2, 5, 4, key);
				break;
			case 9:
				swap(obj.ct, 4, 5, 6, 7, key);
				swap(obj.rl, 3, 2, 7, 6, key);
				swap(obj.ct, 11, 10, 15, 14, key);
				break;
			case 10:
				swap(obj.rl, 4, 5, 6, 7, key);
				swap(obj.ct, 0, 8, 4, 14, key);
				swap(obj.ct, 3, 11, 7, 13, key);
				break;
			case 11:
				swap(obj.ct, 12, 13, 14, 15, key);
				swap(obj.rl, 1, 4, 7, 2, key);
				swap(obj.ct, 1, 0, 7, 6, key);
		}
	}

	function $rot_0(obj, r) {
		switch (r) {
			case 0:
				doMoveCenter2(obj, 19);
				doMoveCenter2(obj, 28);
				break;
			case 1:
				doMoveCenter2(obj, 21);
				doMoveCenter2(obj, 32);
				break;
			case 2:
				swap(obj.ct, 0, 3, 1, 2, 1);
				swap(obj.ct, 8, 11, 9, 10, 1);
				swap(obj.ct, 4, 7, 5, 6, 1);
				swap(obj.ct, 12, 15, 13, 14, 1);
				swap(obj.rl, 0, 3, 5, 6, 1);
				swap(obj.rl, 1, 2, 4, 7, 1);
		}
	}

	function $set_2(obj, c, edgeParity) {
		var i;
		for (i = 0; i < 16; ++i) {
			obj.ct[i] = c.ct[i] % 3;
		}
		for (i = 0; i < 8; ++i) {
			obj.rl[i] = c.ct[i + 16];
		}
		obj.parity = edgeParity;
	}

	function $setct(obj, idx) {
		var i, r;
		r = 8;
		obj.ct[15] = 0;
		for (i = 14; i >= 0; --i) {
			if (idx >= Cnk[i][r]) {
				idx -= Cnk[i][r--];
				obj.ct[i] = 1;
			} else {
				obj.ct[i] = 0;
			}
		}
	}

	function $setrl(obj, idx) {
		var i, r;
		obj.parity = idx & 1;
		idx >>>= 1;
		r = 4;
		obj.rl[7] = 0;
		for (i = 6; i >= 0; --i) {
			if (idx >= Cnk[i][r]) {
				idx -= Cnk[i][r--];
				obj.rl[i] = 1;
			} else {
				obj.rl[i] = 0;
			}
		}
	}

	function Center2() {
		this.rl = createArray(8);
		this.ct = createArray(16);
		this.parity = 0;
	}

	Center2.prototype.copy = function(obj) {
		for (var i = 0; i < 8; i++) {
			this.rl[i] = obj.rl[i];
		}
		for (var i = 0; i < 16; i++) {
			this.ct[i] = obj.ct[i];
		}
		this.parity = obj.parity;
	}
	var ctmv, ctprun, ctrot, pmv, rlmv, rlrot;

	function initCenter2() {
		var ct, ctx, depth, done, i, idx, j, m_0, rl, rlx;
		var c = new Center2;
		var d = new Center2;
		for (i = 0; i < 70; ++i) {
			for (m_0 = 0; m_0 < 28; ++m_0) {
				$setrl(c, i);
				doMoveCenter2(c, move2std[m_0]);
				rlmv[i][m_0] = $getrl(c);
			}
		}
		for (i = 0; i < 70; ++i) {
			$setrl(c, i);
			for (j = 0; j < 16; ++j) {
				rlrot[i][j] = $getrl(c);
				$rot_0(c, 0);
				j % 2 == 1 && $rot_0(c, 1);
				j % 8 == 7 && $rot_0(c, 2);
			}
		}
		for (i = 0; i < 6435; ++i) {
			$setct(c, i);
			for (j = 0; j < 16; ++j) {
				ctrot[i][j] = $getct(c);
				$rot_0(c, 0);
				j % 2 == 1 && $rot_0(c, 1);
				j % 8 == 7 && $rot_0(c, 2);
			}
		}
		for (i = 0; i < 6435; ++i) {
			$setct(c, i);
			for (m_0 = 0; m_0 < 28; ++m_0) {
				d.copy(c);
				doMoveCenter2(d, move2std[m_0]);
				ctmv[i][m_0] = $getct(d);
			}
		}
		fill_0(ctprun);
		ctprun[0] = ctprun[18] = ctprun[28] = ctprun[46] = ctprun[54] = ctprun[56] = 0;
		depth = 0;
		done = 6;

		while (done != 450450) {
			var inv = depth > 6;
			var select = inv ? -1 : depth;
			var check = inv ? depth : -1;
			++depth;
			for (i = 0; i < 450450; ++i) {
				if (ctprun[i] != select) {
					continue;
				}
				ct = ~~(i / 70);
				rl = i % 70;
				for (m_0 = 0; m_0 < 23; ++m_0) {
					ctx = ctmv[ct][m_0];
					rlx = rlmv[rl][m_0];
					idx = ctx * 70 + rlx;
					if (ctprun[idx] != check) {
						continue;
					}
					++done;
					if (inv) {
						ctprun[i] = depth;
						break;
					} else {
						ctprun[idx] = depth;
					}
				}
			}
		}
	}

	function $clinit_Center3() {
		$clinit_Center3 = nullMethod;
		ctmove = createArray(29400, 20);
		pmove = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
		prun_0 = createArray(29400);
		rl2std = [0, 9, 14, 23, 27, 28, 41, 42, 46, 55, 60, 69];
		std2rl = createArray(70);
	}

	function $getct_0(obj) {
		var check, i, idx, idxrl, r;
		idx = 0;
		r = 4;
		for (i = 6; i >= 0; --i) {
			obj.ud[i] != obj.ud[7] && (idx += Cnk[i][r--]);
		}
		idx *= 35;
		r = 4;
		for (i = 6; i >= 0; --i) {
			obj.fb[i] != obj.fb[7] && (idx += Cnk[i][r--]);
		}
		idx *= 12;
		check = obj.fb[7] ^ obj.ud[7];
		idxrl = 0;
		r = 4;
		for (i = 7; i >= 0; --i) {
			obj.rl[i] != check && (idxrl += Cnk[i][r--]);
		}
		return obj.parity + 2 * (idx + std2rl[idxrl]);
	}

	function doMoveCenter3(obj, i) {
		obj.parity ^= pmove[i];
		switch (i) {
			case 0:
			case 1:
			case 2:
				swap(obj.ud, 0, 1, 2, 3, i % 3);
				break;
			case 3:
				swap(obj.rl, 0, 1, 2, 3, 1);
				break;
			case 4:
			case 5:
			case 6:
				swap(obj.fb, 0, 1, 2, 3, (i - 1) % 3);
				break;
			case 7:
			case 8:
			case 9:
				swap(obj.ud, 4, 5, 6, 7, (i - 1) % 3);
				break;
			case 10:
				swap(obj.rl, 4, 5, 6, 7, 1);
				break;
			case 11:
			case 12:
			case 13:
				swap(obj.fb, 4, 5, 6, 7, (i + 1) % 3);
				break;
			case 14:
				swap(obj.ud, 0, 1, 2, 3, 1);
				swap(obj.rl, 0, 5, 4, 1, 1);
				swap(obj.fb, 0, 5, 4, 1, 1);
				break;
			case 15:
				swap(obj.rl, 0, 1, 2, 3, 1);
				swap(obj.fb, 1, 4, 7, 2, 1);
				swap(obj.ud, 1, 6, 5, 2, 1);
				break;
			case 16:
				swap(obj.fb, 0, 1, 2, 3, 1);
				swap(obj.ud, 3, 2, 5, 4, 1);
				swap(obj.rl, 0, 3, 6, 5, 1);
				break;
			case 17:
				swap(obj.ud, 4, 5, 6, 7, 1);
				swap(obj.rl, 3, 2, 7, 6, 1);
				swap(obj.fb, 3, 2, 7, 6, 1);
				break;
			case 18:
				swap(obj.rl, 4, 5, 6, 7, 1);
				swap(obj.fb, 0, 3, 6, 5, 1);
				swap(obj.ud, 0, 3, 4, 7, 1);
				break;
			case 19:
				swap(obj.fb, 4, 5, 6, 7, 1);
				swap(obj.ud, 0, 7, 6, 1, 1);
				swap(obj.rl, 1, 4, 7, 2, 1);
		}
	}

	function $set_3(obj, c, eXc_parity) {
		var i, parity;
		parity = c.ct[0] % 3 > c.ct[8] % 3 ^ c.ct[8] % 3 > c.ct[16] % 3 ^ c.ct[0] % 3 > c.ct[16] % 3 ? 0 : 1;
		for (i = 0; i < 8; ++i) {
			obj.ud[i] = ~~(c.ct[i] / 3) ^ 1;
			obj.fb[i] = ~~(c.ct[i + 8] / 3) ^ 1;
			obj.rl[i] = ~~(c.ct[i + 16] / 3) ^ 1 ^ parity;
		}
		obj.parity = parity ^ eXc_parity;
	}

	function $setct_0(obj, idx) {
		var i, idxfb, idxrl, r;
		obj.parity = idx & 1;
		idx >>>= 1;
		idxrl = rl2std[idx % 12];
		idx = ~~(idx / 12);
		r = 4;
		for (i = 7; i >= 0; --i) {
			obj.rl[i] = 0;
			if (idxrl >= Cnk[i][r]) {
				idxrl -= Cnk[i][r--];
				obj.rl[i] = 1;
			}
		}
		idxfb = idx % 35;
		idx = ~~(idx / 35);
		r = 4;
		obj.fb[7] = 0;
		for (i = 6; i >= 0; --i) {
			if (idxfb >= Cnk[i][r]) {
				idxfb -= Cnk[i][r--];
				obj.fb[i] = 1;
			} else {
				obj.fb[i] = 0;
			}
		}
		r = 4;
		obj.ud[7] = 0;
		for (i = 6; i >= 0; --i) {
			if (idx >= Cnk[i][r]) {
				idx -= Cnk[i][r--];
				obj.ud[i] = 1;
			} else {
				obj.ud[i] = 0;
			}
		}
	}

	function Center3() {
		this.ud = createArray(8);
		this.rl = createArray(8);
		this.fb = createArray(8);
		this.parity = 0;
	}

	Center3.prototype.copy = function(obj) {
		for (var i = 0; i < 8; i++) {
			this.ud[i] = obj.ud[i];
			this.rl[i] = obj.rl[i];
			this.fb[i] = obj.fb[i];
		}
		this.parity = obj.parity;
	}
	var ctmove, pmove, prun_0, rl2std, std2rl;

	function initCenter3() {
		var depth, done, i, m_0;
		for (i = 0; i < 12; ++i) {
			std2rl[rl2std[i]] = i;
		}
		var c = new Center3;
		var d = new Center3;
		for (i = 0; i < 29400; ++i) {
			$setct_0(c, i);
			for (m_0 = 0; m_0 < 20; ++m_0) {
				d.copy(c);
				doMoveCenter3(d, m_0);
				ctmove[i][m_0] = $getct_0(d);
			}
		}
		fill_0(prun_0);
		prun_0[0] = 0;
		depth = 0;
		done = 1;
		while (done != 29400) {
			for (i = 0; i < 29400; ++i) {
				if (prun_0[i] != depth) {
					continue;
				}
				for (m_0 = 0; m_0 < 17; ++m_0) {
					if (prun_0[ctmove[i][m_0]] == -1) {
						prun_0[ctmove[i][m_0]] = depth + 1;
						++done;
					}
				}
			}
			++depth;
		}
	}

	function $copy_1(obj, c) {
		var i;
		for (i = 0; i < 24; ++i) {
			obj.ct[i] = c.ct[i];
		}
	}

	function doMoveCenterCube(obj, m_0) {
		var key;
		key = m_0 % 3;
		m_0 = ~~(m_0 / 3);
		switch (m_0) {
			case 6: // u
				swap(obj.ct, 8, 20, 12, 16, key);
				swap(obj.ct, 9, 21, 13, 17, key);
			case 0: // U
				swap(obj.ct, 0, 1, 2, 3, key);
				break;
			case 7: // r
				swap(obj.ct, 1, 15, 5, 9, key);
				swap(obj.ct, 2, 12, 6, 10, key);
			case 1: // R
				swap(obj.ct, 16, 17, 18, 19, key);
				break;
			case 8: // f
				swap(obj.ct, 2, 19, 4, 21, key);
				swap(obj.ct, 3, 16, 5, 22, key);
			case 2: // F
				swap(obj.ct, 8, 9, 10, 11, key);
				break;
			case 9: // d
				swap(obj.ct, 10, 18, 14, 22, key);
				swap(obj.ct, 11, 19, 15, 23, key);
			case 3: // D
				swap(obj.ct, 4, 5, 6, 7, key);
				break;
			case 10: // l
				swap(obj.ct, 0, 8, 4, 14, key);
				swap(obj.ct, 3, 11, 7, 13, key);
			case 4: // L
				swap(obj.ct, 20, 21, 22, 23, key);
				break;
			case 11: // b
				swap(obj.ct, 1, 20, 7, 18, key);
				swap(obj.ct, 0, 23, 6, 17, key);
			case 5: // B
				swap(obj.ct, 12, 13, 14, 15, key);
				break;
		}
	}

	function CenterCube() {
		this.ct = [];
		for (var i = 0; i < 24; ++i) {
			this.ct[i] = centerFacelet[i] >> 4;
		}
	}

	function $clinit_CornerCube() {
		$clinit_CornerCube = nullMethod;
		CornerMoveCube = createArray(18);
		cornerFacelet_0 = [
			[8, 9, 20],
			[6, 18, 38],
			[0, 36, 47],
			[2, 45, 11],
			[29, 26, 15],
			[27, 44, 24],
			[33, 53, 42],
			[35, 17, 51]
		];
		initMove_0();
	}

	function $$init_2(obj) {
		obj.cp = [0, 1, 2, 3, 4, 5, 6, 7];
		obj.co = [0, 0, 0, 0, 0, 0, 0, 0];
	}

	function $copy_2(obj, c) {
		var i;
		for (i = 0; i < 8; ++i) {
			obj.cp[i] = c.cp[i];
			obj.co[i] = c.co[i];
		}
	}

	function $move_3(obj, idx) {
		!obj.temps && (obj.temps = new CornerCube_0);
		CornMult_0(obj, CornerMoveCube[idx], obj.temps);
		$copy_2(obj, obj.temps);
	}

	function $setTwist_0(obj, idx) {
		var i, twst;
		twst = 0;
		for (i = 6; i >= 0; --i) {
			twst += obj.co[i] = idx % 3;
			idx = ~~(idx / 3);
		}
		obj.co[7] = (15 - twst) % 3;
	}

	function CornMult_0(a, b, prod) {
		var corn, ori, oriA, oriB;
		for (corn = 0; corn < 8; ++corn) {
			prod.cp[corn] = a.cp[b.cp[corn]];
			oriA = a.co[b.cp[corn]];
			oriB = b.co[corn];
			ori = oriA;
			ori = ori + (oriA < 3 ? oriB : 6 - oriB);
			ori = ori % 3;
			oriA >= 3 ^ oriB >= 3 && (ori = ori + 3);
			prod.co[corn] = ori;
		}
	}

	function CornerCube_0() {
		$$init_2(this);
	}

	function CornerCube_1(cperm, twist) {
		$$init_2(this);
		mathlib.setNPerm(this.cp, cperm, 8);
		$setTwist_0(this, twist);
	}

	function initMove_0() {
		var a, p_0;
		CornerMoveCube[0] = new CornerCube_1(15120, 0);
		CornerMoveCube[3] = new CornerCube_1(21021, 1494);
		CornerMoveCube[6] = new CornerCube_1(8064, 1236);
		CornerMoveCube[9] = new CornerCube_1(9, 0);
		CornerMoveCube[12] = new CornerCube_1(1230, 412);
		CornerMoveCube[15] = new CornerCube_1(224, 137);
		for (a = 0; a < 18; a += 3) {
			for (p_0 = 0; p_0 < 2; ++p_0) {
				CornerMoveCube[a + p_0 + 1] = new CornerCube_0;
				CornMult_0(CornerMoveCube[a + p_0], CornerMoveCube[a], CornerMoveCube[a + p_0 + 1]);
			}
		}
	}

	defineClass(CornerCube_0, CornerCube_1);
	_.temps = null;
	var cornerFacelet_0, CornerMoveCube;

	function $clinit_Edge3() {
		$clinit_Edge3 = nullMethod;
		prunValues = [1, 4, 16, 55, 324, 1922, 12275, 77640, 485359, 2778197, 11742425, 27492416, 31002941, 31006080];
		Edge3Prun = new Int32Array(1937880);
		Edge3Sym2Raw = createArray(1538);
		Edge3Sym2Mask = createArray(1538);
		symstate = createArray(1538);
		Edge3Raw2Sym = createArray(11880);
		syminv_0 = [0, 1, 6, 3, 4, 5, 2, 7];
		mvrot = createArray(168, 12);
		mvroto = createArray(168, 12);
		factX = [1, 1, 1, 3, 12, 60, 360, 2520, 20160, 181440, 1814400, 19958400, 239500800];
		FullEdgeMap = [0, 2, 4, 6, 1, 3, 7, 5, 8, 9, 10, 11];
	}

	function $circlex(obj, a, b, c, d) {
		var temp;
		temp = obj.edgeo[d];
		obj.edgeo[d] = obj.edge[c];
		obj.edge[c] = obj.edgeo[b];
		obj.edgeo[b] = obj.edge[a];
		obj.edge[a] = temp;
	}

	function $get_2(obj, end, returnMask) {
		obj.isStd || $std(obj);
		return get12Perm(obj.edge, end, returnMask);
	}

	function get12Perm(arr, end, returnMask) {
		var idx = 0;
		var mask = 0;
		for (var i = 0; i < end; i++) {
			var val = arr[i];
			idx = idx * (12 - i) + val - mathlib.bitCount(mask & ((1 << val) - 1));
			mask |= 1 << val;
		}
		return returnMask ? mask : idx;
	}

	function $getsym_0(obj) {
		obj.isStd || $std(obj);
		return getMvSym(obj.edge, 20) >> 3;
	}

	function $move_4(obj, i) {
		obj.isStd = false;
		switch (i) {
			case 0:
				circle(obj.edge, 0, 4, 1, 5);
				circle(obj.edgeo, 0, 4, 1, 5);
				break;
			case 1:
				$swap_0(obj.edge, 0, 4, 1, 5);
				$swap_0(obj.edgeo, 0, 4, 1, 5);
				break;
			case 2:
				circle(obj.edge, 0, 5, 1, 4);
				circle(obj.edgeo, 0, 5, 1, 4);
				break;
			case 3:
				$swap_0(obj.edge, 5, 10, 6, 11);
				$swap_0(obj.edgeo, 5, 10, 6, 11);
				break;
			case 4:
				circle(obj.edge, 0, 11, 3, 8);
				circle(obj.edgeo, 0, 11, 3, 8);
				break;
			case 5:
				$swap_0(obj.edge, 0, 11, 3, 8);
				$swap_0(obj.edgeo, 0, 11, 3, 8);
				break;
			case 6:
				circle(obj.edge, 0, 8, 3, 11);
				circle(obj.edgeo, 0, 8, 3, 11);
				break;
			case 7:
				circle(obj.edge, 2, 7, 3, 6);
				circle(obj.edgeo, 2, 7, 3, 6);
				break;
			case 8:
				$swap_0(obj.edge, 2, 7, 3, 6);
				$swap_0(obj.edgeo, 2, 7, 3, 6);
				break;
			case 9:
				circle(obj.edge, 2, 6, 3, 7);
				circle(obj.edgeo, 2, 6, 3, 7);
				break;
			case 10:
				$swap_0(obj.edge, 4, 8, 7, 9);
				$swap_0(obj.edgeo, 4, 8, 7, 9);
				break;
			case 11:
				circle(obj.edge, 1, 9, 2, 10);
				circle(obj.edgeo, 1, 9, 2, 10);
				break;
			case 12:
				$swap_0(obj.edge, 1, 9, 2, 10);
				$swap_0(obj.edgeo, 1, 9, 2, 10);
				break;
			case 13:
				circle(obj.edge, 1, 10, 2, 9);
				circle(obj.edgeo, 1, 10, 2, 9);
				break;
			case 14:
				$swap_0(obj.edge, 0, 4, 1, 5);
				$swap_0(obj.edgeo, 0, 4, 1, 5);
				circle(obj.edge, 9, 11);
				circle(obj.edgeo, 8, 10);
				break;
			case 15:
				$swap_0(obj.edge, 5, 10, 6, 11);
				$swap_0(obj.edgeo, 5, 10, 6, 11);
				circle(obj.edge, 1, 3);
				circle(obj.edgeo, 0, 2);
				break;
			case 16:
				$swap_0(obj.edge, 0, 11, 3, 8);
				$swap_0(obj.edgeo, 0, 11, 3, 8);
				circle(obj.edge, 5, 7);
				circle(obj.edgeo, 4, 6);
				break;
			case 17:
				$swap_0(obj.edge, 2, 7, 3, 6);
				$swap_0(obj.edgeo, 2, 7, 3, 6);
				circle(obj.edge, 8, 10);
				circle(obj.edgeo, 9, 11);
				break;
			case 18:
				$swap_0(obj.edge, 4, 8, 7, 9);
				$swap_0(obj.edgeo, 4, 8, 7, 9);
				circle(obj.edge, 0, 2);
				circle(obj.edgeo, 1, 3);
				break;
			case 19:
				$swap_0(obj.edge, 1, 9, 2, 10);
				$swap_0(obj.edgeo, 1, 9, 2, 10);
				circle(obj.edge, 4, 6);
				circle(obj.edgeo, 5, 7);
		}
	}

	function $rot_1(obj, r) {
		obj.isStd = false;
		switch (r) {
			case 0:
				$move_4(obj, 14);
				$move_4(obj, 17);
				break;
			case 1:
				$circlex(obj, 11, 5, 10, 6);
				$circlex(obj, 5, 10, 6, 11);
				$circlex(obj, 1, 2, 3, 0);
				$circlex(obj, 4, 9, 7, 8);
				$circlex(obj, 8, 4, 9, 7);
				$circlex(obj, 0, 1, 2, 3);
				break;
			case 2:
				$swapx(obj, 4, 5);
				$swapx(obj, 5, 4);
				$swapx(obj, 11, 8);
				$swapx(obj, 8, 11);
				$swapx(obj, 7, 6);
				$swapx(obj, 6, 7);
				$swapx(obj, 9, 10);
				$swapx(obj, 10, 9);
				$swapx(obj, 1, 1);
				$swapx(obj, 0, 0);
				$swapx(obj, 3, 3);
				$swapx(obj, 2, 2);
		}
	}

	function $rotate_0(obj, r) {
		while (r >= 2) {
			r -= 2;
			$rot_1(obj, 1);
			$rot_1(obj, 2);
		}
		r != 0 && $rot_1(obj, 0);
	}

	function $set_4(obj, idx) {
		var i, p_0, parity, v, vall, valh;
		vall = 0x76543210;
		valh = 0xba98;
		parity = 0;
		for (i = 0; i < 11; ++i) {
			p_0 = factX[11 - i];
			v = ~~(idx / p_0);
			idx = idx % p_0;
			parity ^= v;
			v <<= 2;
			if (v >= 32) {
				v = v - 32;
				obj.edge[i] = valh >> v & 15;
				var m = (1 << v) - 1;
				valh = (valh & m) + ((valh >> 4) & ~m);
			} else {
				obj.edge[i] = vall >> v & 15;
				var m = (1 << v) - 1;
				vall = (vall & m) + ((vall >>> 4) & ~m) + (valh << 28);
				valh = valh >> 4;
			}
		}
		if ((parity & 1) == 0) {
			obj.edge[11] = vall;
		} else {
			obj.edge[11] = obj.edge[10];
			obj.edge[10] = vall;
		}
		for (i = 0; i < 12; ++i) {
			obj.edgeo[i] = i;
		}
		obj.isStd = true;
	}

	function $set_5(obj, e) {
		var i;
		for (i = 0; i < 12; ++i) {
			obj.edge[i] = e.edge[i];
			obj.edgeo[i] = e.edgeo[i];
		}
		obj.isStd = e.isStd;
	}

	function $set_6(obj, c) {
		var i, parity, s, t;
		obj.temp == null && (obj.temp = createArray(12));
		for (i = 0; i < 12; ++i) {
			obj.temp[i] = i;
			obj.edge[i] = c.ep[FullEdgeMap[i] + 12] % 12;
		}
		parity = 1;
		for (i = 0; i < 12; ++i) {
			while (obj.edge[i] != i) {
				t = obj.edge[i];
				obj.edge[i] = obj.edge[t];
				obj.edge[t] = t;
				s = obj.temp[i];
				obj.temp[i] = obj.temp[t];
				obj.temp[t] = s;
				parity ^= 1;
			}
		}
		for (i = 0; i < 12; ++i) {
			obj.edge[i] = obj.temp[c.ep[FullEdgeMap[i]] % 12];
		}
		return parity;
	}

	function $std(obj) {
		var i;
		obj.temp == null && (obj.temp = createArray(12));
		for (i = 0; i < 12; ++i) {
			obj.temp[obj.edgeo[i]] = i;
		}
		for (i = 0; i < 12; ++i) {
			obj.edge[i] = obj.temp[obj.edge[i]];
			obj.edgeo[i] = i;
		}
		obj.isStd = true;
	}

	function $swap_0(arr, a, b, c, d) {
		var temp;
		temp = arr[a];
		arr[a] = arr[c];
		arr[c] = temp;
		temp = arr[b];
		arr[b] = arr[d];
		arr[d] = temp;
	}

	function $swapx(obj, x, y) {
		var temp;
		temp = obj.edge[x];
		obj.edge[x] = obj.edgeo[y];
		obj.edgeo[y] = temp;
	}

	function Edge3_0() {
		this.edge = createArray(12);
		this.edgeo = createArray(12);
		this.isStd = true;
		this.temp = null;
	}
	var FullEdgeMap,
		Edge3Prun, factX, mvrot, mvroto, prunValues, Edge3Raw2Sym, Edge3Sym2Raw, Edge3Sym2Mask, syminv_0, symstate;

	function initEdge3Prun() {
		var chk, cord1, cord1x, cord2, cord2x, e, f, find_0, g, j, symState, symcord1, val;
		e = new Edge3_0;
		f = new Edge3_0;
		g = new Edge3_0;
		fill_0(Edge3Prun);

		var depth = 0;
		var done = 1;
		var doneRaw = 1;
		setPruning(Edge3Prun, 0, 0);
		var bfsMoves = [1, 0, 2, 3, 5, 4, 6, 8, 7, 9, 10, 12, 11, 13, 14, 15, 16];
		var start = $.now();
		while (done != 31006080) {
			var inv = depth > 9;
			var depm3 = depth % 3;
			var dep1m3 = (depth + 1) % 3;
			var dep2m3 = (depth + 2) % 3;
			find_0 = inv ? 3 : depm3;
			chk = inv ? depm3 : 3;
			var find_mask = find_0 * 0x55555555;
			if (depth >= EDGE3_MAX_PRUN - 1) {
				break;
			}
			for (var i_ = 0; i_ < 31006080; i_ += 16) {
				val = Edge3Prun[i_ >> 4];
				var chkmask = val ^ find_mask;
				if  (!inv && val == -1 || ((chkmask - 0x55555555) & ~chkmask & 0xaaaaaaaa) == 0) {
					continue;
				}
				for (var i = i_, end = i_ + 16; i < end; ++i, val >>= 2) {
					if ((val & 3) != find_0) {
						continue;
					}
					symcord1 = ~~(i / 20160);
					cord1 = Edge3Sym2Raw[symcord1];
					cord2 = i % 20160;
					$set_4(e, cord1 * 20160 + cord2);
					for (var mi = 0; mi < 17; ++mi) {
						var m = bfsMoves[mi]
						var idx = getMvSym(e.edge, m, Edge3SymMove[m][symcord1]);
						var symx = idx & 7;
						idx >>= 3;
						var prun = getPruning_0(Edge3Prun, idx);
						if (prun != chk) {
							if (prun == dep2m3 || prun == depm3 && idx < i) {
								mi = skipAxis3[m];
							}
							continue;
						}
						setPruning(Edge3Prun, inv ? i : idx, dep1m3);
						++done;
						if (inv) {
							break;
						}
						var symcord1x = ~~(idx / 20160);
						symState = symstate[symcord1x];
						if (symState == 1) {
							continue;
						}
						$set_5(f, e);
						$move_4(f, m);
						$rotate_0(f, symx);
						for (j = 1;
							(symState = symState >> 1) != 0; ++j) {
							if ((symState & 1) != 1) {
								continue;
							}
							$set_5(g, f);
							$rotate_0(g, j);
							var idxx = symcord1x * 20160 + $get_2(g, 10) % 20160;
							if (getPruning_0(Edge3Prun, idxx) == chk) {
								setPruning(Edge3Prun, idxx, dep1m3);
								++done;
							}
						}
					}
				}
			}
			++depth;
			DEBUG && console.log('[scramble 444] edge3 pruning ', depth, done, $.now() - start);
		}
	}

	function getPruning_0(table, index) {
		return table[index >> 4] >> ((index & 15) << 1) & 3;
	}

	function getMvSym(ep, mv, assumeIdx) {
		var mrIdx = mv << 3;
		var movo, mov;
		var idx = 0;
		var mask = 0;
		if (assumeIdx !== undefined && move3std[mv] % 3 == 1) {
			mrIdx |= assumeIdx & 0x7;
			idx = assumeIdx >> 3;
		} else {
			movo = mvroto[mrIdx];
			mov = mvrot[mrIdx];
			for (var i = 0; i < 4; i++) {
				var val = movo[ep[mov[i]]];
				idx = idx * (12 - i) + val - mathlib.bitCount(mask & ((1 << val) - 1));
				mask |= 1 << val;
			}
			idx = Edge3Raw2Sym[idx];
			mrIdx |= idx & 7;
			idx >>= 3;
		}
		movo = mvroto[mrIdx];
		mov = mvrot[mrIdx];
		mask = Edge3Sym2Mask[idx];
		for (var i = 4; i < 10; i++) {
			var val = movo[ep[mov[i]]];
			idx = idx * (12 - i) + val - mathlib.bitCount(mask & ((1 << val) - 1));
			mask |= 1 << val;
		}
		return idx << 3 | mrIdx & 0x7;
	}

	var EDGE3_MAX_PRUN = 10;

	function getprun(edge) {
		var cord1, cord1x, cord2, cord2x, depm3, depth, e, idx, symcord1;
		e = new Edge3_0;
		depth = 0;
		depm3 = getPruning_0(Edge3Prun, edge);
		if (depm3 == 3) {
			return EDGE3_MAX_PRUN;
		}
		while (edge != 0) {
			depm3 = (depm3 + 2) % 3;
			symcord1 = ~~(edge / 20160);
			cord1 = Edge3Sym2Raw[symcord1];
			cord2 = edge % 20160;
			$set_4(e, cord1 * 20160 + cord2);
			for (var m = 0; m < 17; ++m) {
				idx = getMvSym(e.edge, m) >> 3;
				if (getPruning_0(Edge3Prun, idx) == depm3) {
					++depth;
					edge = idx;
					break;
				}
			}
		}
		return depth;
	}

	function getprun_0(edge, prun) {
		var depm3 = getPruning_0(Edge3Prun, edge);
		if (depm3 == 3) {
			return EDGE3_MAX_PRUN;
		}
		return ((0x49249249 << depm3 >> prun) & 3) + prun - 1;
		// (depm3 - prun + 16) % 3 + prun - 1;
	}

	function initEdge3MvRot() {
		var e = new Edge3_0;
		for (var m = 0; m < 21; ++m) {
			for (var r = 0; r < 8; ++r) {
				$set_4(e, 0);
				$move_4(e, m);
				$rotate_0(e, r);
				for (var i = 0; i < 12; ++i) {
					mvrot[m << 3 | r][i] = e.edge[i];
				}
				$std(e);
				for (var i = 0; i < 12; ++i) {
					mvroto[m << 3 | r][i] = e.temp[i];
				}
			}
		}
	}

	var Edge3SymMove = [];

	function initEdge3Sym2Raw() {
		var count, e, idx, j, occ;
		e = new Edge3_0;
		occ = createArray(1485);
		for (var i = 0; i < 1485; i++) {
			occ[i] = 0;
		}
		count = 0;
		for (var i = 0; i < 11880; ++i) {
			if ((occ[i >>> 3] & 1 << (i & 7)) == 0) {
				$set_4(e, i * factX[8]);
				Edge3Sym2Raw[count] = i;
				Edge3Sym2Mask[count] = $get_2(e, 4, true);
				for (j = 0; j < 8; ++j) {
					idx = $get_2(e, 4);
					idx == i && (symstate[count] = symstate[count] | 1 << j);
					occ[idx >> 3] |= 1 << (idx & 7);
					Edge3Raw2Sym[idx] = count << 3 | syminv_0[j];
					$rot_1(e, 0);
					if (j % 2 == 1) {
						$rot_1(e, 1);
						$rot_1(e, 2);
					}
				}
				count++;
			}
		}
		for (var m = 0; m < 20; m++) {
			Edge3SymMove[m] = [];
		}
		for (var i = 0; i < 1538; i++) {
			$set_4(e, Edge3Sym2Raw[i] * factX[8]);
			for (var m = 0; m < 20; ++m) {
				if (move3std[m] % 3 != 1) {
					continue;
				}
				idx = getMvSym(e.edge, m);
				Edge3SymMove[m][i] = ~~((idx >> 3) / 20160) << 3 | idx & 0x7;
			}
		}
	}

	function setPruning(table, index, value) {
		table[index >> 4] ^= (3 ^ value) << ((index & 15) << 1);
	}

	function checkPhase2Edge(epInv, moves, length) {
		var parity = 0;
		for (var i = 0; i < 12; i++) {
			var e = epInv[i];
			var eo = epInv[i + 12];
			for (var j = 0; j < length; j++) {
				var moveMap = epMoveMap[moves[j]];
				e = moveMap[e];
				eo = moveMap[eo];
			}
			if ((e < 12) != (eo >= 12)) {
				return false;
			}
			parity ^= e >= 12 ? 1 : 0
		}
		return parity == 0;
	}

	function $copy_3(obj, c) {
		var i;
		for (i = 0; i < 24; ++i) {
			obj.ep[i] = c.ep[i];
		}
	}

	function doMoveEdge(obj, m_0) {
		var key;
		key = m_0 % 3;
		m_0 = ~~(m_0 / 3);
		switch (m_0) {
			case 6:
				swap(obj.ep, 9, 22, 11, 20, key);
			case 0:
				swap(obj.ep, 0, 1, 2, 3, key);
				swap(obj.ep, 12, 13, 14, 15, key);
				break;
			case 7:
				swap(obj.ep, 2, 16, 6, 12, key);
			case 1:
				swap(obj.ep, 11, 15, 10, 19, key);
				swap(obj.ep, 23, 3, 22, 7, key);
				break;
			case 8:
				swap(obj.ep, 3, 19, 5, 13, key);
			case 2:
				swap(obj.ep, 0, 11, 6, 8, key);
				swap(obj.ep, 12, 23, 18, 20, key);
				break;
			case 9:
				swap(obj.ep, 8, 23, 10, 21, key);
			case 3:
				swap(obj.ep, 4, 5, 6, 7, key);
				swap(obj.ep, 16, 17, 18, 19, key);
				break;
			case 10:
				swap(obj.ep, 14, 0, 18, 4, key);
			case 4:
				swap(obj.ep, 1, 20, 5, 21, key);
				swap(obj.ep, 13, 8, 17, 9, key);
				break;
			case 11:
				swap(obj.ep, 7, 15, 1, 17, key);
			case 5:
				swap(obj.ep, 2, 9, 4, 10, key);
				swap(obj.ep, 14, 21, 16, 22, key);
				break;
		}
	}

	function EdgeCube() {
		this.ep = [];
		for (var i = 0; i < 24; ++i) {
			this.ep[i] = i;
		}
	}

	function $clinit_FullCube_0() {
		$clinit_FullCube_0 = nullMethod;
		move2rot = [35, 1, 34, 2, 4, 6, 22, 5, 19];
	}

	function $$init_3(obj) {
		obj.moveBuffer = createArray(60);
	}

	function $copy_4(obj, c) {
		var i;
		$copy_3(obj.edge, c.edge);
		$copy_1(obj.center, c.center);
		$copy_2(obj.corner, c.corner);
		obj.value = c.value;
		obj.add1 = c.add1;
		obj.length1 = c.length1;
		obj.length2 = c.length2;
		obj.length3 = c.length3;
		obj.sym = c.sym;
		for (i = 0; i < 60; ++i) {
			obj.moveBuffer[i] = c.moveBuffer[i];
		}
		obj.moveLength = c.moveLength;
		obj.edgeAvail = c.edgeAvail;
		obj.centerAvail = c.centerAvail;
		obj.cornerAvail = c.cornerAvail;
	}

	var centerFacelet = [5, 6, 10, 9, 53, 54, 58, 57, 37, 38, 42, 41, 85, 86, 90, 89, 21, 22, 26, 25, 69, 70, 74, 73];
	var cornerFacelet = [[15, 16, 35], [12, 32, 67], [0, 64, 83], [3, 80, 19], [51, 47, 28], [48, 79, 44], [60, 95, 76], [63, 31, 92]];
	var edgeFacelet = [[13, 33], [4, 65], [2, 81], [11, 17], [61, 94], [52, 78], [50, 46], [59, 30], [75, 40], [68, 87], [27, 88], [20, 39], [34, 14], [66, 8], [82, 1], [18, 7], [93, 62], [77, 56], [45, 49], [29, 55], [36, 71], [91, 72], [84, 23], [43, 24]];

	function $fromFacelet(obj, f) {
		var ctMask = 0;
		var edMask = 0;
		var cpMask = 0;
		var coSum = 0;
		for (var i = 0; i < 24; i++) {
			obj.center.ct[i] = f[centerFacelet[i]];
			ctMask += 1 << f[centerFacelet[i]] * 4;
		}
		for (var i = 0; i < 24; i++) {
			for (var j = 0; j < 24; j++) {
				if (f[edgeFacelet[i][0]] == (edgeFacelet[j][0] >> 4) && f[edgeFacelet[i][1]] == (edgeFacelet[j][1] >> 4)) {
					obj.edge.ep[i] = j;
					edMask |= 1 << j;
				}
			}
		}
		var col1, col2, ori;
		for (var i = 0; i<8; i++) {
			for (ori = 0; ori < 3; ori++) {
				if (f[cornerFacelet[i][ori]] == 0 || f[cornerFacelet[i][ori]] == 3) {
					break;
				}
			}
			col1 = f[cornerFacelet[i][(ori + 1) % 3]];
			col2 = f[cornerFacelet[i][(ori + 2) % 3]];
			for (var j = 0; j < 8; j++) {
				if (col1 == (cornerFacelet[j][1] >> 4) && col2 == (cornerFacelet[j][2] >> 4)) {
					obj.corner.cp[i] = j;
					obj.corner.co[i] = ori % 3;
					cpMask |= 1 << j;
					coSum += ori % 3;
					break;
				}
			}
		}
		return (cpMask != 0xff) * 1 + (coSum % 3 != 0) * 2 + (ctMask != 0x444444) * 4 + (edMask != 0xffffff) * 8;;
	}

	function toFacelet(obj) {
		getCenter(obj);
		$getCorner(obj);
		$getEdge(obj);
		var f = [];
		for (var i = 0; i < 24; i++) {
			f[centerFacelet[i]] = obj.center.ct[i];
		}
		for (var i = 0; i < 24; i++) {
			f[edgeFacelet[i][0]] = edgeFacelet[obj.edge.ep[i]][0] >> 4;
			f[edgeFacelet[i][1]] = edgeFacelet[obj.edge.ep[i]][1] >> 4;
		}
		for (var c=0; c<8; c++) {
			var j = obj.corner.cp[c];
			var ori = obj.corner.co[c];
			for (var n=0; n<3; n++) {
				f[cornerFacelet[c][(n + ori) % 3]] = cornerFacelet[j][n] >> 4;
			}
		}
		return f;
	}

	function to333Facelet(obj) {
		var f = toFacelet(obj);
		var chks = [[1, 2], [4, 8], [7, 11], [13, 14], [5, 6, 9, 10]];
		var map4to3 = [0, 1, 3, 4, 5, 7, 12, 13, 15];
		var f3 = [];
		for (var fidx = 0; fidx < 6; fidx++) {
			for (var i = 0; i < chks.length; i++) {
				var cmp = f[fidx << 4 | chks[i][0]];
				for (var j = 1; j < chks[i].length; j++) {
					if (cmp != f[fidx << 4 | chks[i][j]]) {
						console.log('reduction error', chks[i][j], chks[i][0]);
						return null;
					}
				}
			}
			for (var i = 0; i < map4to3.length; i++) {
				f3[fidx * 9 + i] = f[fidx << 4 | map4to3[i]];
			}
		}
		return f3;
	}

	function getCenter(obj) {
		while (obj.centerAvail < obj.moveLength) {
			doMoveCenterCube(obj.center, obj.moveBuffer[obj.centerAvail++]);
		}
		return obj.center;
	}

	function $getCorner(obj) {
		while (obj.cornerAvail < obj.moveLength) {
			$move_3(obj.corner, obj.moveBuffer[obj.cornerAvail++] % 18);
		}
		return obj.corner;
	}

	function $getEdge(obj) {
		while (obj.edgeAvail < obj.moveLength) {
			doMoveEdge(obj.edge, obj.moveBuffer[obj.edgeAvail++]);
		}
		return obj.edge;
	}

	function getMoveString(obj) {
		var finishSym, fixedMoves, i, i_1, idx, move, rot, ret, sym, axis, pows;
		fixedMoves = new Array(obj.moveLength - (obj.add1 ? 2 : 0));
		idx = 0;
		for (i = 0; i < obj.length1; ++i) {
			fixedMoves[idx++] = obj.moveBuffer[i];
		}
		sym = obj.sym;
		for (i = obj.length1 + (obj.add1 ? 2 : 0); i < obj.moveLength; ++i) {
			if (SymMove[sym][obj.moveBuffer[i]] >= 27) {
				fixedMoves[idx++] = SymMove[sym][obj.moveBuffer[i]] - 9;
				rot = move2rot[SymMove[sym][obj.moveBuffer[i]] - 27];
				sym = SymMult[sym][rot];
			} else {
				fixedMoves[idx++] = SymMove[sym][obj.moveBuffer[i]];
			}
		}
		finishSym = SymMult[SymInv[sym]][getSolvedSym(getCenter(obj))];
		ret = [];
		sym = finishSym;
		for (i = idx - 1; i >= 0; --i) {
			move = fixedMoves[i];
			move = ~~(move / 3) * 3 + (2 - move % 3);
			if (SymMove[sym][move] >= 27) {
				ret.push(SymMove[sym][move] - 9);
				rot = move2rot[SymMove[sym][move] - 27];
				sym = SymMult[sym][rot];
			} else {
				ret.push(SymMove[sym][move]);
			}
		}
		axis = -1;
		idx = 0;
		pows = [0, 0, 0];
		for (i = 0; i < ret.length; ++i) {
			move = ret[i];
			if (axis != ~~(move / 3) % 3) {
				for (i_1 = 0; i_1 < 3; i_1++) {
					if (pows[i_1] % 4) {
						ret[idx++] = move2str_1[i_1 * 9 + axis * 3 + pows[i_1] - 1] + ' ';
						pows[i_1] = 0;
					}
				}
				axis = ~~(move / 3) % 3;
			}
			pows[~~(move / 9)] += move % 3 + 1;
		}
		for (i_1 = 0; i_1 < 3; i_1++) {
			if (pows[i_1] % 4) {
				ret[idx++] = move2str_1[i_1 * 9 + axis * 3 + pows[i_1] - 1] + ' ';
				pows[i_1] = 0;
			}
		}
		ret = ret.slice(0, idx).join('');
		return ret;
	}

	function $move_6(obj, m_0) {
		obj.moveBuffer[obj.moveLength++] = m_0;
	}

	function FullCube_3() {
		$$init_3(this);
		this.edge = new EdgeCube();
		this.center = new CenterCube();
		this.corner = new CornerCube_0;
	}

	function FullCube_4(c) {
		FullCube_3.call(this);
		$copy_4(this, c);
	}

	defineClass(FullCube_3, FullCube_4);
	_.add1 = false;
	_.center = null;
	_.centerAvail = 0;
	_.corner = null;
	_.cornerAvail = 0;
	_.edge = null;
	_.edgeAvail = 0;
	_.length1 = 0;
	_.length2 = 0;
	_.length3 = 0;
	_.moveLength = 0;
	_.sym = 0;
	_.value = 0;
	var move2rot;

	function $compare_0(c1, c2) {
		return c2.value - c1.value;
	}

	function $clinit_Moves() {
		$clinit_Moves = nullMethod;
		var i, j;
		move2str_1 = ['U  ', 'U2 ', "U' ", 'R  ', 'R2 ', "R' ", 'F  ', 'F2 ', "F' ", 'D  ', 'D2 ', "D' ", 'L  ', 'L2 ', "L' ", 'B  ', 'B2 ', "B' ", 'Uw ', 'Uw2', "Uw'", 'Rw ', 'Rw2', "Rw'", 'Fw ', 'Fw2', "Fw'", 'Dw ', 'Dw2', "Dw'", 'Lw ', 'Lw2', "Lw'", 'Bw ', 'Bw2', "Bw'"];
		move2std = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 22, 23, 25, 28, 30, 31, 32, 34, 36];
		move3std = [0, 1, 2, 4, 6, 7, 8, 9, 10, 11, 13, 15, 16, 17, 19, 22, 25, 28, 31, 34, 36];
		std2move = createArray(37);
		std3move = createArray(37);
		ckmv = createArray(37, 36);
		ckmv2_0 = createArray(29, 28);
		ckmv3 = createArray(21, 20);
		skipAxis = createArray(36);
		skipAxis2 = createArray(28);
		skipAxis3 = createArray(20);
		epMoveMap = createArray(36, 24);
		for (i = 0; i < 29; ++i) {
			std2move[move2std[i]] = i;
		}
		for (i = 0; i < 21; ++i) {
			std3move[move3std[i]] = i;
		}
		for (i = 0; i < 36; ++i) {
			for (j = 0; j < 36; ++j) {
				ckmv[i][j] = ~~(i / 3) == ~~(j / 3) || ~~(i / 3) % 3 == ~~(j / 3) % 3 && i > j;
			}
			ckmv[36][i] = false;
		}
		for (i = 0; i < 29; ++i) {
			for (j = 0; j < 28; ++j) {
				ckmv2_0[i][j] = ckmv[move2std[i]][move2std[j]];
			}
		}
		for (i = 0; i < 21; ++i) {
			for (j = 0; j < 20; ++j) {
				ckmv3[i][j] = ckmv[move3std[i]][move3std[j]];
			}
		}
		for (i = 0; i < 36; ++i) {
			skipAxis[i] = 36;
			for (j = i; j < 36; ++j) {
				if (!ckmv[i][j]) {
					skipAxis[i] = j - 1;
					break;
				}
			}
		}
		for (i = 0; i < 28; ++i) {
			skipAxis2[i] = 28;
			for (j = i; j < 28; ++j) {
				if (!ckmv2_0[i][j]) {
					skipAxis2[i] = j - 1;
					break;
				}
			}
		}
		for (i = 0; i < 20; ++i) {
			skipAxis3[i] = 20;
			for (j = i; j < 20; ++j) {
				if (!ckmv3[i][j]) {
					skipAxis3[i] = j - 1;
					break;
				}
			}
		}
		for (i = 0; i < 36; ++i) {
			var edge = new EdgeCube();
			doMoveEdge(edge, i);
			for (j = 0; j < 24; j++) {
				epMoveMap[i][edge.ep[j]] = j;
			}
		}
	}

	var ckmv, ckmv2_0, ckmv3, move2std, move2str_1, move3std, skipAxis, skipAxis2, skipAxis3, std2move, std3move, epMoveMap;

	function $doSearch(obj) {
		var MAX_LENGTH2, MAX_LENGTH3, ct, edge, eparity, fb, fbprun, index, length12, length123, p1SolsArr, prun, rl, rlprun, s2ct, s2rl, solcube, ud, udprun;
		obj.solution = '';
		var tt = $.now();
		ud = $getsym(new Center1().fromCube(getCenter(obj.c), 0));
		fb = $getsym(new Center1().fromCube(getCenter(obj.c), 1));
		rl = $getsym(new Center1().fromCube(getCenter(obj.c), 2));
		udprun = Center1SymPrun[ud >> 6];
		fbprun = Center1SymPrun[fb >> 6];
		rlprun = Center1SymPrun[rl >> 6];
		obj.p1SolsCnt = 0;
		obj.arr2idx = 0;
		$clear(obj.p1sols);
		for (obj.length1 = Math.min(udprun, fbprun, rlprun); obj.length1 < MAX_SEARCH_DEPTH; ++obj.length1) {
			if (rlprun <= obj.length1 && phase1Search(obj, rl >>> 6, rl & 63, obj.length1, -1, 0)
					|| udprun <= obj.length1 && phase1Search(obj, ud >>> 6, ud & 63, obj.length1, -1, 0)
					|| fbprun <= obj.length1 && phase1Search(obj, fb >>> 6, fb & 63, obj.length1, -1, 0)) {
				break;
			}
		}
		p1SolsArr = obj.p1sols.array.slice();
		var tt1 = $.now() - tt;
		DEBUG && console.log('[scramble 444] Phase 1 Done in', $.now() - tt);
		p1SolsArr.sort(function(a, b) {
			return a.value - b.value
		});
		MAX_LENGTH2 = 9;
		do {
			OUT: for (length12 = p1SolsArr[0].value; length12 < MAX_SEARCH_DEPTH; ++length12) {
					for (var i = 0; i < p1SolsArr.length; ++i) {
						var cc = p1SolsArr[i];
						if (cc.value > length12) {
							break;
						}
						if (length12 - cc.length1 > MAX_LENGTH2) {
							continue;
						}
						$copy_4(obj.c1, cc);
						var ep = $getEdge(obj.c1).ep;
						$set_2(obj.ct2, getCenter(obj.c1), parity_0(ep));
						s2ct = $getct(obj.ct2);
						s2rl = $getrl(obj.ct2);
						obj.length1 = cc.length1;
						obj.length2 = length12 - cc.length1;
						obj.epInv = [];
						for (var e = 0; e < 24; e++) {
							obj.epInv[ep[e]] = e;
						}
						if (phase2Search(obj, s2ct, s2rl, obj.length2, 28, 0)) {
							break OUT;
						}
					}
				}
				++MAX_LENGTH2;
		} while (length12 == MAX_SEARCH_DEPTH);
		obj.arr2.sort(function(a, b) {
			return a.value - b.value
		});
		DEBUG && console.log('[scramble 444] Phase 2 Done in', $.now() - tt);
		var tt2 = $.now() - tt - tt1;
		index = 0;
		MAX_LENGTH3 = 13;
		do {
			OUT2: for (length123 = obj.arr2[0].value; length123 < MAX_SEARCH_DEPTH; ++length123) {
					for (var i = 0; i < Math.min(obj.arr2idx, PHASE2_SOLS); ++i) {
						if (obj.arr2[i].value > length123) {
							break;
						}
						obj.arr2[i].length3 = length123 - obj.arr2[i].length1 - obj.arr2[i].length2;
						if (obj.arr2[i].length3 > MAX_LENGTH3) {
							continue;
						}
						eparity = $set_6(obj.e12, $getEdge(obj.arr2[i]));
						$set_3(obj.ct3, getCenter(obj.arr2[i]), eparity ^ parity_0($getCorner(obj.arr2[i]).cp));
						ct = $getct_0(obj.ct3);
						edge = $get_2(obj.e12, 10);
						for (var j = 0; j < 12; j++) {
							obj.tempep[0][j] = obj.e12.edge[j];
						}
						prun = getprun($getsym_0(obj.e12));
						if (prun <= obj.arr2[i].length3
								&& phase3Search(obj, obj.tempep[0], ct, prun, obj.arr2[i].length3, 20, 0)) {
							index = i;
							break OUT2;
						}
					}
				}
				++MAX_LENGTH3;
		}
		while (length123 == MAX_SEARCH_DEPTH);
		DEBUG && console.log('[scramble 444] Phase 3 Done in', $.now() - tt);
		var tt3 = $.now() - tt - tt1 - tt2;

		solcube = new FullCube_4(obj.arr2[index]);
		obj.length1 = solcube.length1;
		obj.length2 = solcube.length2;
		obj.length3 = solcube.length3;
		for (var i = 0; i < obj.length3; ++i) {
			$move_6(solcube, move3std[obj.move3[i]]);
		}
		var f3 = to333Facelet(solcube);
		if (!f3) {
			console.log('[scramble 444] Reduction Error!', toFacelet(solcube));
		}
		for (var i = 0; i < 54; i++) {
			f3[i] = "URFDLB"[f3[i]];
		}
		f3 = f3.join('');
		var sol3 = scramble_333.solvFacelet(f3).split(' ');
		var length333 = 0;
		for (var m = 0; m < sol3.length; m++) {
			if (/^[URFDLB][2']?$/.exec(sol3[m])) {
				length333++;
				$move_6(solcube, "URFDLB".indexOf(sol3[m][0]) * 3 + "2'".indexOf(sol3[m][1]) + 1);
			}
		}
		obj.solution = getMoveString(solcube);
		DEBUG && console.log('[scramble 444] 3x3x3 Done in', $.now() - tt);
		DEBUG && console.log('[scramble 444] Phase depths: ', [obj.length1, obj.length2, obj.length3, length333, tt1, tt2, tt3]);
		return [obj.length1, obj.length2, obj.length3, length333, tt1, tt2, tt3];
	}

	function printState(state) {
		var tmp =
			"          U0U1U2U3\n" +
			"          U4U5U6U7\n" +
			"          U8U9UaUb\n" +
			"          UcUdUeUf\n" +
			"L0L1L2L3  F0F1F2F3  R0R1R2R3  B0B1B2B3\n" +
			"L4L5L6L7  F4F5F6F7  R4R5R6R7  B4B5B6B7\n" +
			"L8L9LaLb  F8F9FaFb  R8R9RaRb  B8B9BaBb\n" +
			"LcLdLeLf  FcFdFeFf  RcRdReRf  BcBdBeBf\n" +
			"          D0D1D2D3\n" +
			"          D4D5D6D7\n" +
			"          D8D9DaDb\n" +
			"          DcDdDeDf\n";
		tmp = tmp.replace(/[URFDLB][0-9a-f]/g, function(m) {
			var i1 = "URFDLB".indexOf(m[0]);
			var i2 = "0123456789abcdef".indexOf(m[1]);
			var posit = state[i1 * 16 + i2];
			return "URFDLB"[posit] + ' ';
		});
	}

	function $init2_0(obj, sym) {
		var ctp, i, next, s2ct, s2rl;
		$copy_4(obj.c1, obj.c);
		for (i = 0; i < obj.length1; ++i) {
			$move_6(obj.c1, obj.move1[i]);
		}
		switch (finish_0[sym]) {
			case 0:
				$move_6(obj.c1, 24);
				$move_6(obj.c1, 35);
				obj.move1[obj.length1] = 24;
				obj.move1[obj.length1 + 1] = 35;
				obj.add1 = true;
				sym = 19;
				break;
			case 12869:
				$move_6(obj.c1, 18);
				$move_6(obj.c1, 29);
				obj.move1[obj.length1] = 18;
				obj.move1[obj.length1 + 1] = 29;
				obj.add1 = true;
				sym = 34;
				break;
			case 735470:
				obj.add1 = false;
				sym = 0;
		}
		$set_2(obj.ct2, getCenter(obj.c1), parity_0($getEdge(obj.c1).ep));
		s2ct = $getct(obj.ct2);
		s2rl = $getrl(obj.ct2);
		ctp = ctprun[s2ct * 70 + s2rl];
		obj.c1.value = ctp + obj.length1;
		obj.c1.length1 = obj.length1;
		obj.c1.add1 = obj.add1;
		obj.c1.sym = sym;
		++obj.p1SolsCnt;
		if (obj.p1sols.size < PHASE2_ATTS) {
			next = new FullCube_4(obj.c1);
		} else {
			next = $poll(obj.p1sols);
			next.value > obj.c1.value && $copy_4(next, obj.c1);
		}
		$add(obj.p1sols, next);
		return obj.p1SolsCnt == PHASE1_SOLS;
	}

	function $init3(obj) {
		if (!checkPhase2Edge(obj.epInv, obj.move2, obj.length2)) {
			return false;
		}
		var ct, eparity, i, prun;
		$copy_4(obj.c2, obj.c1);
		for (i = 0; i < obj.length2; ++i) {
			$move_6(obj.c2, obj.move2[i]);
		}
		eparity = $set_6(obj.e12, $getEdge(obj.c2));
		$set_3(obj.ct3, getCenter(obj.c2), eparity ^ parity_0($getCorner(obj.c2).cp));
		ct = $getct_0(obj.ct3);
		$get_2(obj.e12, 10);
		prun = getprun($getsym_0(obj.e12));
		!obj.arr2[obj.arr2idx] ? (obj.arr2[obj.arr2idx] = new FullCube_4(obj.c2)) : $copy_4(obj.arr2[obj.arr2idx], obj.c2);
		obj.arr2[obj.arr2idx].value = obj.length1 + obj.length2 + Math.max(prun, prun_0[ct]);
		obj.arr2[obj.arr2idx].length2 = obj.length2;
		++obj.arr2idx;
		return obj.arr2idx == obj.arr2.length;
	}

	function phase1Search(obj, ct, sym, maxl, lm, depth) {
		var axis, ctx, m_0, power, prun, symx;
		if (ct == 0) {
			return maxl == 0 && $init2_0(obj, sym);
		}
		for (axis = 0; axis < 27; axis += 3) {
			if (axis == lm || axis == lm - 9 || axis == lm - 18) {
				continue;
			}
			for (power = 0; power < 3; ++power) {
				m_0 = axis + power;
				ctx = Center1SymMove[ct][SymMove[sym][m_0]];
				prun = Center1SymPrun[ctx >>> 6];
				if (prun >= maxl) {
					if (prun > maxl) {
						break;
					}
					continue;
				}
				symx = SymMult[sym][ctx & 63];
				ctx >>>= 6;
				obj.move1[depth] = m_0;
				if (phase1Search(obj, ctx, symx, maxl - 1, axis, depth + 1)) {
					return true;
				}
			}
		}
		return false;
	}

	function phase2Search(obj, ct, rl, maxl, lm, depth) {
		var ctx, m_0, prun, rlx;
		if (ct == 0 && ctprun[rl] == 0 && maxl < 5) {
			return maxl == 0 && $init3(obj);
		}
		for (m_0 = 0; m_0 < 23; ++m_0) {
			if (ckmv2_0[lm][m_0]) {
				m_0 = skipAxis2[m_0];
				continue;
			}
			ctx = ctmv[ct][m_0];
			rlx = rlmv[rl][m_0];
			prun = ctprun[ctx * 70 + rlx];
			if (prun >= maxl) {
				prun > maxl && (m_0 = skipAxis2[m_0]);
				continue;
			}
			obj.move2[depth] = move2std[m_0];
			if (phase2Search(obj, ctx, rlx, maxl - 1, m_0, depth + 1)) {
				return true;
			}
		}
		return false;
	}

	function phase3Search(obj, eplast, ct, prun, maxl, lm, depth) {
		if (maxl == 0) {
			return true;
		}
		var ep = obj.tempep[depth];
		if (lm != 20) {
			var movo = mvroto[lm << 3];
			var mov = mvrot[lm << 3];
			for (var i = 0; i < 12; i++) {
				ep[i] = movo[eplast[mov[i]]];
			}
		}
		for (var m = 0; m < 17; m++) {
			if (ckmv3[lm][m]) {
				m = skipAxis3[m];
				continue;
			}
			var ctx = ctmove[ct][m];
			var prun1 = prun_0[ctx];
			if (prun1 >= maxl) {
				prun1 > maxl && m < 14 && (m = skipAxis3[m]);
				continue;
			}
			var prunx = getprun_0(getMvSym(ep, m) >> 3, prun);
			if (prunx >= maxl) {
				prunx > maxl && m < 14 && (m = skipAxis3[m]);
				continue;
			}
			if (phase3Search(obj, ep, ctx, prunx, maxl - 1, m, depth + 1)) {
				obj.move3[depth] = m;
				return true;
			}
		}
		return false;
	}

	function Search_4() {
		var i;
		this.p1sols = new PriorityQueue_0();
		this.move1 = createArray(15);
		this.move2 = createArray(20);
		this.move3 = createArray(20);
		this.c1 = new FullCube_3;
		this.c2 = new FullCube_3;
		this.ct2 = new Center2;
		this.ct3 = new Center3;
		this.e12 = new Edge3_0;
		this.tempep = createArray(20);
		this.arr2 = createArray(PHASE2_SOLS);
		for (i = 0; i < 20; ++i) {
			this.tempep[i] = [];
		}
		this.add1 = false;
		this.arr2idx = 0;
		this.c = null;
		this.length1 = 0;
		this.length2 = 0;
		this.p1SolsCnt = 0;
		this.solution = '';
	}

	function parity_0(arr) {
		var parity = 0;
		var mask = 0;
		for (var i = 0; i < arr.length; i++) {
			var val = arr[i];
			parity ^= val - mathlib.bitCount(mask & ((1 << val) - 1));
			mask |= 1 << val;
		}
		return parity & 1;
	}

	function swap(arr, a, b, c, d, key) {
		var temp;
		switch (key) {
			case 0:
				temp = arr[d];
				arr[d] = arr[c];
				arr[c] = arr[b];
				arr[b] = arr[a];
				arr[a] = temp;
				return;
			case 1:
				temp = arr[a];
				arr[a] = arr[c];
				arr[c] = temp;
				temp = arr[b];
				arr[b] = arr[d];
				arr[d] = temp;
				return;
			case 2:
				temp = arr[a];
				arr[a] = arr[b];
				arr[b] = arr[c];
				arr[c] = arr[d];
				arr[d] = temp;
				return;
		}
	}

	function $add(obj, o) {
		if ($offer(obj, o)) {
			return true;
		}
	}

	function $add_0(obj, o) {
		obj.array[obj.size++] = o;
		return true;
	}

	function $clear(obj) {
		obj.array = [];
		obj.size = 0;
	}

	function $get_4(obj, index) {
		return obj.array[index];
	}

	function $remove_0(obj, index) {
		var previous;
		previous = obj.array[index];
		obj.array.splice(index, 1);
		--obj.size;
		return previous;
	}

	function $set_7(obj, index, o) {
		var previous;
		previous = obj.array[index];
		obj.array[index] = o;
		return previous;
	}

	function PriorityQueue_0() {
		this.array = [];
		this.array.length = PHASE2_ATTS;
		this.size = 0;
	}

	function binarySearch_0(sortedArray, key) {
		var high, low, mid, midVal;
		low = 0;
		high = sortedArray.length - 1;
		while (low <= high) {
			mid = low + ((high - low) >> 1);
			midVal = sortedArray[mid];
			if (midVal < key) {
				low = mid + 1;
			} else if (midVal > key) {
				high = mid - 1;
			} else {
				return mid;
			}
		}
		return -low - 1;
	}

	function fill_0(a) {
		for (var i = 0; i < a.length; i++) {
			a[i] = -1;
		}
	}

	function $mergeHeaps(obj, node) {
		var heapSize, smallestChild, value, leftChild, rightChild, smallestChild_0;
		heapSize = obj.size;
		value = $get_4(obj, node);
		while (node * 2 + 1 < heapSize) {
			smallestChild = (leftChild = 2 * node + 1, rightChild = leftChild + 1, smallestChild_0 = leftChild, rightChild < heapSize && $compare_0($get_4(obj, rightChild), $get_4(obj, leftChild)) < 0 && (smallestChild_0 = rightChild), smallestChild_0);
			if ($compare_0(value, $get_4(obj, smallestChild)) < 0) {
				break;
			}
			$set_7(obj, node, $get_4(obj, smallestChild));
			node = smallestChild;
		}
		$set_7(obj, node, value);
	}

	function $offer(obj, e) {
		var childNode, node;
		node = obj.size;
		$add_0(obj, e);
		while (node > 0) {
			childNode = node;
			node = (node - 1) >> 1;
			if ($compare_0($get_4(obj, node), e) <= 0) {
				$set_7(obj, childNode, e);
				return true;
			}
			$set_7(obj, childNode, $get_4(obj, node));
		}
		$set_7(obj, node, e);
		return true;
	}

	function $poll(obj) {
		var value;
		if (obj.size == 0) {
			return null;
		}
		value = $get_4(obj, 0);
		$removeAtIndex(obj);
		return value;
	}

	function $removeAtIndex(obj) {
		var lastValue;
		lastValue = $remove_0(obj, obj.size - 1);
		if (0 < obj.size) {
			$set_7(obj, 0, lastValue);
			$mergeHeaps(obj, 0);
		}
	}

	var searcher;

	function init() {
		init = nullMethod;
		var tt = $.now();
		DEBUG && console.log('[scramble 444] start initialization');
		$clinit_Moves();
		$clinit_Center1();
		$clinit_Center2();
		$clinit_Center3();
		$clinit_Edge3();
		$clinit_CornerCube();
		$clinit_FullCube_0();
		reportStage("tables", 15);
		DEBUG && console.log('[scramble 444] alloc tables', $.now() - tt);
		initSymMeta();
		reportStage("symmetry", 25);
		DEBUG && console.log('[scramble 444] initSymMeta', $.now() - tt);
		Center1Raw2Sym = createArray(735471);
		initCenter1Sym2Raw();
		reportStage("center1-raw", 35);
		DEBUG && console.log('[scramble 444] initCenter1Sym2Raw', $.now() - tt);
		initCenter1MoveTable();
		reportStage("center1-move", 45);
		DEBUG && console.log('[scramble 444] initCenter1MoveTable', $.now() - tt);
		Center1Raw2Sym = null;
		initCenter1Prun();
		reportStage("center1-prune", 55);
		DEBUG && console.log('[scramble 444] initCenter1Prun', $.now() - tt);

		initCenter2();
		reportStage("center2", 65);
		DEBUG && console.log('[scramble 444] initCenter2', $.now() - tt);
		initCenter3();
		reportStage("center3", 75);
		DEBUG && console.log('[scramble 444] initCenter3', $.now() - tt);
		initEdge3MvRot();
		reportStage("edge3-move", 82);
		DEBUG && console.log('[scramble 444] initEdge3MvRot', $.now() - tt);
		initEdge3Sym2Raw();
		reportStage("edge3-raw", 89);
		DEBUG && console.log('[scramble 444] initEdge3Sym2Raw', $.now() - tt);
		initEdge3Prun();
		reportStage("edge3-prune", 95);
		DEBUG && console.log('[scramble 444] initEdge3Prun', $.now() - tt);
		searcher = new Search_4();
		reportStage("ready", 100);
	}

	function partialSolvedState(ctMask, edMask, cnMask, neut) {
		var facelet;
		var colmap = [0, 1, 2, 3, 4, 5];
		if (neut) {
			var ori = mathlib.rn([1, 4, 8, 1, 1, 1, 24][neut]);
			if (ori >= 8) {
				mathlib.acycle(colmap, [0, 1, 2], ori >> 3);
				mathlib.acycle(colmap, [3, 4, 5], ori >> 3);
				ori &= 0x7;
			}
			if (ori >= 4) {
				mathlib.acycle(colmap, [0, 1, 3, 4], 2);
				ori &= 0x3;
			}
			if (ori >= 1) {
				mathlib.acycle(colmap, [1, 2, 4, 5], ori);
			}
		}
		var solved = true;
		for (var _ = 0; solved && _ < 100; _++) {
			var cc = new FullCube_3;
			var ctSwaps = [];
			var edSwaps = [];
			var cnSwaps = [];
			for (var i = 0; i < 24; i++) {
				if (ctMask >> i & 1) {
					ctSwaps.push(i);
				}
				if (edMask >> i & 1) {
					edSwaps.push(i);
				}
				if (cnMask >> i & 1) {
					cnSwaps.push(i);
				}
			}
			var ctPerm = mathlib.rndPerm(ctSwaps.length);
			for (var i = 0; i < ctSwaps.length; i++) {
				cc.center.ct[ctSwaps[i]] = centerFacelet[ctSwaps[ctPerm[i]]] >> 4;
			}
			var edPerm = mathlib.rndPerm(edSwaps.length);
			for (var i = 0; i < edSwaps.length; i++) {
				cc.edge.ep[edSwaps[i]] = edSwaps[edPerm[i]];
			}
			var cnPerm = mathlib.rndPerm(cnSwaps.length);
			var coSum = 24;
			for (var i = 0; i < cnSwaps.length; i++) {
				var co = mathlib.rn(3);
				cc.corner.co[cnSwaps[i]] = co;
				cc.corner.cp[cnSwaps[i]] = cnSwaps[cnPerm[i]];
				coSum -= co;
			}
			if (coSum % 3 != 0) {
				cc.corner.co[cnSwaps[0]] = (cc.corner.co[cnSwaps[0]] + coSum) % 3;
			}
			facelet = toFacelet(cc);
			for (var i = 0; i < 96; i++) {
				facelet[i] = "URFDLB".charAt(colmap[facelet[i]]);
				if (facelet[i] != facelet[i >> 4 << 4]) {
					solved = false;
				}
			}
		}
		return facelet.join("");
	}

	function genFacelet(facelet) {
		init();
		facelet = facelet.split('');
		for (var i = 0; i < 96; i++) {
			facelet[i] = "URFDLB".indexOf(facelet[i]);
		}
		DEBUG && console.log('[scramble 444] Scramble to state:');
		DEBUG && printState(facelet);
		searcher.c = new FullCube_3;
		var chk = $fromFacelet(searcher.c, facelet);
		if (chk != 0) {
			console.log('[scramble 444] State Check Error!', chk, facelet);
		}
		$doSearch(searcher);
		return searcher.solution.replace(/\s+/g, ' ');
	}

	function testbench(nsolv) {
		init();
		nsolv = nsolv || 100;
		var avgs = [];
		for (var i = 0; i < nsolv; i++) {
			var facelet = partialSolvedState(0xffffff, 0xffffff, 0xff).split('');
			for (var j = 0; j < 96; j++) {
				facelet[j] = "URFDLB".indexOf(facelet[j]);
			}
			searcher.c = new FullCube_3;
			var chk = $fromFacelet(searcher.c, facelet);
			if (chk != 0) {
				console.log('[scramble 444] State Check Error!', chk, facelet);
			}
			var tt = $.now();
			var data = $doSearch(searcher);
			for (var j = 0; j < data.length; j++) {
				avgs[j] = (avgs[j] || 0) + data[j];
			}
			console.log(avgs.map((x) => ~~(100 * x / (i + 1)) / 100));
		}
	}

	function getPartialScramble(ctMask, edMask, cnMask, neut) {
		return genFacelet(partialSolvedState(ctMask, edMask, cnMask, neut));
	}

	function getRandomScramble() {
		return genFacelet(partialSolvedState(0xffffff, 0xffffff, 0xff));
	}

	function getYauUD3CScramble(type, length, cases, neut) {
		var unsolv = mathlib.rn(4);
		return getPartialScramble(0xffff00, 0xff0ff0 | (0x1001 << unsolv), 0xff, neut);
	}

	function getHoyaRLDAScramble(type, length, cases, neut) {
		var unsolv = mathlib.rn(2) * 4;
		return getPartialScramble(0x0000f0 | (0xf00 << unsolv), 0xffffff, 0xff, neut);
	}

	function getHoyaRLCAScramble(type, length, cases, neut) {
		var unsolv = mathlib.rn(2) * 4;
		return getPartialScramble(0x0000f0 | (0xf00 << unsolv), 0xff0ff0, 0xff, neut);
	}

	function getEdgeScramble() {
		return getPartialScramble(0x000000, 0xffffff, 0xff);
	}

	function getEdgeOnlyScramble() {
		return getPartialScramble(0x000000, 0xffffff, 0x00);
	}

	function getCenterOnlyScramble() {
		return getPartialScramble(0xffffff, 0x000000, 0x00);
	}

	function getLastLayerScramble(type, length, cases, neut) {
		return getPartialScramble(0x000000, 0x0f00f0, 0xf0, neut);
	}

	function getCenterUDSolvedScramble(type, length, cases, neut) {
		return getPartialScramble(0xffff00, 0xffffff, 0xff, neut);
	}

	function getCenterRLSolvedScramble(type, length, cases, neut) {
		return getPartialScramble(0x00ffff, 0xffffff, 0xff, neut);
	}

	// targetFace: which face the U-color (face 0) should end up on
	//   0=U, 1=R, 2=F, 3=D, 4=L, 5=B
	function appendRotationFix(scramble, targetFace) {
		var testCube = new FullCube_3;
		var moves = scramble.trim().split(/\s+/);
		for (var mi = 0; mi < moves.length; mi++) {
			var mv = moves[mi];
			while (mv.length < 3) mv += ' ';
			var mvIdx = move2str_1.indexOf(mv);
			if (mvIdx >= 0) {
				$move_6(testCube, mvIdx);
			}
		}
		var f = toFacelet(testCube);
		var faceCenters = [5, 21, 37, 53, 69, 85]; // U,R,F,D,L,B
		var uColorAt = -1;
		for (var fi = 0; fi < 6; fi++) {
			if (f[faceCenters[fi]] == 0) {
				uColorAt = fi;
				break;
			}
		}
		// Rotations to bring U-color from position uColorAt to face targetFace.
		// rotTable[from][to] gives the rotation string needed.
		var rotTable = [
			// to:  U      R      F      D      L      B
			/*U*/ ['',    "z",  "x'",   'z2',  "z'",   "x" ],
			/*R*/ ["z'",   '',    "y",  "z",  'z2',  "y'"  ],
			/*F*/ ["x",  "y'",   '',    "x'",   "y",  'x2' ],
			/*D*/ ['z2',  "z'",   "x",  '',    "z",  "x'"  ],
			/*L*/ ["z",  'z2',  "y'",   "z'",   '',    "y" ],
			/*B*/ ["x'",   "y",  'x2',  "x",  "y'",   ''   ]
		];
		targetFace = targetFace || 0;
		var rot = rotTable[uColorAt][targetFace];
		if (rot) {
			scramble = scramble + ' ' + rot;
		}
		return scramble.replace(/\s+/g, ' ').trim();
	}

	function getLast8DedgeScramble(type, length, cases, neut) {
		// D-cross edges (4-7, 16-19) solved, U + equator edges scrambled, all corners scrambled
		var scramble = getPartialScramble(0x000000, 0xf0ff0f, 0xff, neut);
		return appendRotationFix(scramble, 0);
	}

	function getELLScramble(type, length, cases, neut) {
		return getPartialScramble(0x000000, 0x0f00f0, 0x00, neut);
	}

	function applyColorNeutrality(neut) {
		var colmap = [0, 1, 2, 3, 4, 5];
		if (neut) {
			var ori = mathlib.rn([1, 4, 8, 1, 1, 1, 24][neut]);
			if (ori >= 8) {
				mathlib.acycle(colmap, [0, 1, 2], ori >> 3);
				mathlib.acycle(colmap, [3, 4, 5], ori >> 3);
				ori &= 0x7;
			}
			if (ori >= 4) {
				mathlib.acycle(colmap, [0, 1, 3, 4], 2);
				ori &= 0x3;
			}
			if (ori >= 1) {
				mathlib.acycle(colmap, [1, 2, 4, 5], ori);
			}
		}
		return colmap;
	}


	var llU = [3, 0, 1, 2];
	var llUPow = [[0,1,2,3], llU];
	llUPow[2] = llUPow[1].map(function(_, i) { return llU[llUPow[1][i]]; });
	llUPow[3] = llUPow[2].map(function(_, i) { return llU[llUPow[2][i]]; });

	function llConjugate(perm, k) {
		if (k == 0) return perm.slice();
		var uk = llUPow[k];
		var uinv = llUPow[(4 - k) % 4];
		return perm.map(function(_, i) { return uk[perm[uinv[i]]]; });
	}

	function permuteByU(arr, k) {
		if (k == 0) return arr.slice();
		var u = llUPow[k];
		var result = [];
		for (var i = 0; i < 4; i++) {
			result[u[i]] = arr[i];
		}
		return result;
	}

	function fillRandomPerm(arr, n) {
		var free = [], used = {};
		for (var i = 0; i < n; i++) {
			if (arr[i] != -1) used[arr[i]] = true;
		}
		for (var i = 0; i < n; i++) {
			if (!used[i]) free.push(i);
		}
		for (var i = free.length - 1; i > 0; i--) {
			var j = mathlib.rn(i + 1);
			var tmp = free[i]; free[i] = free[j]; free[j] = tmp;
		}
		for (var i = 0, fi = 0; i < n; i++) {
			if (arr[i] == -1) arr[i] = free[fi++];
		}
	}

	function fillRandomOri(arr, n, base) {
		var sum = 0;
		var last = -1;
		for (var i = 0; i < n; i++) {
			if (arr[i] == -1) {
				last = i;
			} else {
				sum += arr[i];
			}
		}
		for (var i = 0; i < n; i++) {
			if (arr[i] == -1 && i != last) {
				arr[i] = mathlib.rn(base);
				sum += arr[i];
			}
		}
		if (last != -1) {
			arr[last] = (base - sum % base) % base;
		}
	}

	// 4x4 last-layer scramble generator.
	// Treats the cube as reduced with D layer solved.
	// Parameters:
	//   _ep: U-layer dedge permutation [4], -1 = random
	//   _eo: U-layer dedge flip [4] (0 = paired, 1 = wings swapped), -1 = random
	//   _cp: U-layer corner permutation [4], -1 = random
	//   _co: U-layer corner orientation [4] (0/1/2), -1 = random (sum constrained to 0 mod 3)
	//   neut: color neutrality level
	//   _rndpre: array of U-power values [0,1,2,3] for pre-AUF (random element chosen)
	//   _rndapp: array of U-power values [0,1,2,3] for post-AUF (random element chosen)
	//   rotFix: target face for rotation fix (0=U, 3=D, etc.), or false/undefined to skip
	function get444LLScramble(_ep, _eo, _cp, _co, neut, _rndpre, _rndapp, rotFix) {
		var ep = _ep.slice();
		var eo = _eo.slice();
		var cp = _cp.slice();
		var co = _co.slice();

		fillRandomPerm(ep, 4);
		fillRandomPerm(cp, 4);
		for (var i = 0; i < 4; i++) {
			if (eo[i] == -1) eo[i] = mathlib.rn(2);
		}
		fillRandomOri(co, 4, 3);

		// Apply pre-AUF by conjugating arrays
		if (_rndpre && _rndpre.length > 0) {
			var k = _rndpre[mathlib.rn(_rndpre.length)];
			if (k > 0) {
				ep = llConjugate(ep, k);
				cp = llConjugate(cp, k);
				eo = permuteByU(eo, k);
				co = permuteByU(co, k);
			}
		}

		// Apply post-AUF by permuting slot contents
		if (_rndapp && _rndapp.length > 0) {
			var k = _rndapp[mathlib.rn(_rndapp.length)];
			if (k > 0) {
				var u = llUPow[k];
				var newEp = [], newEo = [], newCp = [], newCo = [];
				for (var i = 0; i < 4; i++) {
					newEp[u[i]] = ep[i];
					newEo[u[i]] = eo[i];
					newCp[u[i]] = cp[i];
					newCo[u[i]] = co[i];
				}
				ep = newEp; eo = newEo; cp = newCp; co = newCo;
			}
		}

		// Build FullCube_3
		var cc = new FullCube_3;
		for (var i = 0; i < 4; i++) {
			cc.corner.cp[i] = cp[i];
			cc.corner.co[i] = co[i];
		}
		for (var i = 0; i < 4; i++) {
			var src = ep[i];
			if (eo[i]) {
				cc.edge.ep[i] = src + 12;
				cc.edge.ep[i + 12] = src;
			} else {
				cc.edge.ep[i] = src;
				cc.edge.ep[i + 12] = src + 12;
			}
		}

		// Solve
		var colmap = applyColorNeutrality(neut);
		var facelet = toFacelet(cc);
		for (var i = 0; i < 96; i++) {
			facelet[i] = "URFDLB".charAt(colmap[facelet[i]]);
		}
		var scramble = genFacelet(facelet.join("")).replace(/^\s+/, '');

		if (rotFix !== undefined && rotFix !== false) {
			scramble = appendRotationFix(scramble, rotFix);
		}

		return scramble;
	}

	var ppll_map = [
		// EPLL: corners solved, edges permuted with parity
		[[2,1,0,3], [0,1,2,3], 2, 'EPLL-Opp'],
		[[0,1,3,2], [0,1,2,3], 4, 'EPLL-Adj'],
		[[3,0,1,2], [0,1,2,3], 1, 'EPLL-O-'],
		[[1,2,3,0], [0,1,2,3], 1, 'EPLL-O+'],
		[[2,3,1,0], [0,1,2,3], 4, 'EPLL-W'],
		// CPLL: edges solved, corners permuted with parity
		[[0,1,2,3], [2,1,0,3], 2, 'CPLL-pN'],
		[[0,1,2,3], [3,1,2,0], 4, 'CPLL-pJ'],
		[[2,3,0,1], [3,1,2,0], 4, 'CPLL-M'],
		// Diag: diagonal corner swap with parity
		[[1,2,0,3], [2,1,0,3], 4, 'Diag-Sa'],
		[[3,1,0,2], [0,3,2,1], 4, 'Diag-Sb'],
		[[0,3,2,1], [3,2,1,0], 1, 'Diag-Q'],
		[[2,1,0,3], [3,2,1,0], 1, 'Diag-X'],
		// Adj: adjacent corner swap with parity
		[[1,0,3,2], [0,2,1,3], 4, 'Adj-Ka'],
		[[3,2,1,0], [0,2,1,3], 4, 'Adj-Kb'],
		[[3,1,0,2], [3,1,2,0], 4, 'Adj-Pa'],
		[[2,1,3,0], [3,1,2,0], 4, 'Adj-Pb'],
		[[0,1,3,2], [0,2,3,1], 4, 'Adj-Ba'],
		[[0,2,1,3], [3,1,0,2], 4, 'Adj-Bb'],
		[[0,3,1,2], [1,0,2,3], 4, 'Adj-Ca'],
		[[0,2,3,1], [1,0,2,3], 4, 'Adj-Cb'],
		[[2,0,1,3], [0,1,3,2], 4, 'Adj-Da'],
		[[2,1,3,0], [0,1,3,2], 4, 'Adj-Db'],
		// Standard PLL (no parity)
		[[2,3,0,1], [0,1,2,3], 1, 'PLL-H'],
		[[3,0,2,1], [0,1,2,3], 4, 'PLL-Ua'],
		[[1,3,2,0], [0,1,2,3], 4, 'PLL-Ub'],
		[[3,2,1,0], [0,1,2,3], 2, 'PLL-Z'],
		[[0,1,2,3], [1,2,0,3], 4, 'PLL-Aa'],
		[[0,1,2,3], [2,0,1,3], 4, 'PLL-Ab'],
		[[0,1,2,3], [1,0,3,2], 2, 'PLL-E'],
		[[0,3,2,1], [1,0,2,3], 4, 'PLL-F'],
		[[2,0,1,3], [1,2,0,3], 4, 'PLL-Ga'],
		[[1,2,0,3], [2,0,1,3], 4, 'PLL-Gb'],
		[[1,3,2,0], [2,0,1,3], 4, 'PLL-Gc'],
		[[3,0,2,1], [1,2,0,3], 4, 'PLL-Gd'],
		[[3,1,2,0], [1,0,2,3], 4, 'PLL-Ja'],
		[[1,0,2,3], [1,0,2,3], 4, 'PLL-Jb'],
		[[2,1,0,3], [2,1,0,3], 1, 'PLL-Na'],
		[[0,3,2,1], [2,1,0,3], 1, 'PLL-Nb'],
		[[0,1,3,2], [1,0,2,3], 4, 'PLL-Ra'],
		[[0,2,1,3], [1,0,2,3], 4, 'PLL-Rb'],
		[[2,1,0,3], [1,0,2,3], 4, 'PLL-T'],
		[[1,0,2,3], [2,1,0,3], 4, 'PLL-V'],
		[[3,1,2,0], [2,1,0,3], 4, 'PLL-Y']
	];


	var ppllprobs = mathlib.idxArray(ppll_map, 2);
	var ppllfilter = mathlib.idxArray(ppll_map, 3);

	function getPPLLScramble(type, length, cases, neut) {
		var c = ppll_map[scrMgr.fixCase(cases, ppllprobs)];
		return get444LLScramble(c[0], [0,0,0,0], c[1], [0,0,0,0], neut, [0,1,2,3], [0,1,2,3], 0);
	}
	
	// Sticker pattern + optional arrows for the LL plan-view image of each ppll_map case.
	// 12-char string = side stickers adjacent to U face, read as 4 strips of 3:
	//
	//         B[7] B[8] B[9]
	//   L[10]  .    .    .  R[4]
	//   L[11]  .   (U)   .  R[5]
	//   L[12]  .    .    .  R[6]
	//         F[1] F[2] F[3]
	//
	// Letters F/R/B/L = face color of that sticker (front/right/back/left).
	// Arrows [a, b] indicate piece movement from position a to b on the 3x3 grid:
	//   0 1 2
	//   3 4 5
	//   6 7 8
	// 22 parity cases + 21 standard PLLs = 43 total.
	var ppllImgParam = [
		// EPLL (5)
		['BFBRRRFBFLLL', [7, 1], [1, 7]],                         // Opp
		['LBLBLBRRRFFF', [7, 5], [5, 7]],                         // Adj
		['BRBRFRFLFLBL', [1, 3], [3, 7], [7, 5], [5, 1]],        // O-  (CCW)
		['BLBRBRFRFLFL', [1, 5], [5, 7], [7, 3], [3, 1]],        // O+  (CW)
		['BRBRLRFBFLFL'],             // W
		// CPLL (3)
		['LLRFBBRRLBFF', [0, 8], [8, 0]],             // pN  
		['RRFLFRFLLBBB', [2, 8], [8, 2]],             // pJ  
		['RLFLBRFRLBFB'],             // M   
		// Diag (4)
		['LRRFLBRBLBFF'],             // Sa
		['FFBRBLBRFLLR'],             // Sb  
		['RFLBRFLBRFLB'],             // Q
		['RBLBLFLFRFRB'],             // X
		// Adj (10)
		['RRLBBRFLFLFB'],             // Ka
		['RLLBFRFRFLBB'],             // Kb
		['BRRFFBRBFLLL'],             // Pa  
		['FBLBFFLLBRRR'],             // Pb  
		['BRRFLBRFFLBL'],             // Ba
		['RRFLBRFFLBLB'],             // Bb  
		['BLFLRBRFRFBL'],             // Ca  
		['FRBRBFLFLBLR'],             // Cb
		['BFBRRFLLRFBL'],             // Da
		['LRLBLRFBBRFF'],             // Db  
		// PLL (21)
		['BFBRLRFBFLRL', [1, 7], [3, 5]],             // H
		['BRBRLRFFFLBL', [3, 7], [7, 5], [5, 3]],     // Ua
		['BLBRBRFFFLRL', [3, 5], [5, 7], [7, 3]],     // Ub
		['LFLBRBRBRFLF', [1, 5], [3, 7]],             // Z
		['LBBRRLBFRFLF', [0, 2], [2, 6], [6, 0]],     // Aa
		['RBFLRRFFLBLB', [0, 6], [6, 8], [8, 0]],     // Ab
		['LBRFRBRFLBLF', [0, 6], [2, 8]],             // E
		['BFRFRBRBFLLL', [1, 7], [2, 8]],             // F
		['BRRFLBRBFLFL'],                             // Ga
		['BFRFBBRLFLRL'],                             // Gb
		['BFRFLBRRFLBL'],                             // Gc
		['BLRFFBRBFLRL'],                             // Gd
		['BBRFFBRRFLLL', [1, 5], [2, 8]],             // Ja
		['LBBRLLBRRFFF', [2, 8], [5, 7]],             // Jb
		['FBBRLLBFFLRR', [2, 6], [3, 5]],             // Na
		['BBFLLRFFBRRL', [0, 8], [3, 5]],             // Nb
		['LLBRBLBFRFRF', [1, 3], [2, 8]],             // Ra
		['RBFLFRFLLBRB', [2, 8], [3, 7]],             // Rb
		['BBRFLBRFFLRL', [2, 8], [3, 5]],             // T
		['BBFLFRFRBRLL', [0, 8], [1, 5]],             // V
		['BBFLRRFLBRFL', [0, 8], [1, 3]]              // Y
	];

	function getPPLLImage(cases, canvas) {
		var sideStickers3 = ppllImgParam[cases][0]; // 12-char 3x3 side stickers
		var arrows3 = ppllImgParam[cases].slice(1);
		if (arrows3.length == 2) {
			arrows3 = arrows3.concat([[arrows3[0][1], arrows3[0][0]], [arrows3[1][1], arrows3[1][0]]]);
		}

		// Expand to 4x4: U face = 16 'D's, side stickers = 16 chars
		var uFace = 'DDDDDDDDDDDDDDDD';
		// Each 3x3 side strip [corner, edge, corner] -> [corner, edge, edge, corner]
		var side4 = '';
		for (var s = 0; s < 4; s++) {
			var c1 = sideStickers3[s * 3];
			var e  = sideStickers3[s * 3 + 1];
			var c2 = sideStickers3[s * 3 + 2];
			side4 += c1 + e + e + c2;
		}

		// Map 3x3 arrow grid positions to 4x4 [x, y] coordinates
		// 3x3 grid:  0(0,0) 1(1,0) 2(2,0) / 3(0,1) 4(1,1) 5(2,1) / 6(0,2) 7(1,2) 8(2,2)
		// 4x4 grid corners: 0->0,0  2->3,0  6->0,3  8->3,3
		// 4x4 grid edges (midpoint of two wings): 1->1.5,0  3->0,1.5  5->3,1.5  7->1.5,3
		var arrowMap = [[0,0], [1.5,0], [3,0], [0,1.5], [1.5,1.5], [3,1.5], [0,3], [1.5,3], [3,3]];
		var arrows4 = [];
		for (var i = 0; i < arrows3.length; i++) {
			arrows4.push([arrowMap[arrows3[i][0]], arrowMap[arrows3[i][1]]]);
		}

		var llParam = [uFace + side4, arrows4];
		if (!canvas) {
			return llParam.concat([ppllfilter[cases]]);
		}
		image.llImage.drawImage(llParam[0], llParam[1], canvas);
	}



	// POLL case trainer map
	// [co, flipIdx, nOriEdge, aufCount, 'name']
	// co: corner orientation array [URF, UFL, ULB, UBR] (0=oriented, 1=CW twist, 2=CCW twist)
	// flipIdx: edge slot index (0=UF, 1=UL, 2=UB, 3=UR)
	//   for nOriEdge=3: flipIdx is the bad (flipped) edge
	//   for nOriEdge=1: flipIdx is the good (oriented) edge
	// nOriEdge: 3 = three edges oriented (1 bad), 1 = one edge oriented (3 bad)
	// aufCount: probability weight (4 for all cases)
	var poll_map = [
		// === 3 edges oriented ===
		// S
		[[2,0,2,2], 0, 3, 4, '3E-S-F'],
		[[2,0,2,2], 3, 3, 4, '3E-S-R'],
		[[2,0,2,2], 2, 3, 4, '3E-S-B'],
		[[2,0,2,2], 1, 3, 4, '3E-S-L'],
		// A
		[[0,1,1,1], 0, 3, 4, '3E-A-F'],
		[[0,1,1,1], 3, 3, 4, '3E-A-R'],
		[[0,1,1,1], 2, 3, 4, '3E-A-B'],
		[[0,1,1,1], 1, 3, 4, '3E-A-L'],
		// T
		[[0,0,1,2], 0, 3, 4, '3E-T-F'],
		[[0,0,1,2], 3, 3, 4, '3E-T-R'],
		[[0,0,1,2], 2, 3, 4, '3E-T-B'],
		[[0,0,1,2], 1, 3, 4, '3E-T-L'],
		// L
		[[0,1,0,2], 0, 3, 4, '3E-L-F'],
		[[0,1,0,2], 3, 3, 4, '3E-L-R'],
		[[0,1,0,2], 2, 3, 4, '3E-L-B'],
		[[0,1,0,2], 1, 3, 4, '3E-L-L'],
		// U
		[[0,0,2,1], 0, 3, 4, '3E-U-F'],
		[[0,0,2,1], 3, 3, 4, '3E-U-R'],
		[[0,0,2,1], 2, 3, 4, '3E-U-B'],
		[[0,0,2,1], 1, 3, 4, '3E-U-L'],
		// Pi
		[[2,2,1,1], 0, 3, 4, '3E-Pi-F'],
		[[2,2,1,1], 3, 3, 4, '3E-Pi-R'],
		[[2,2,1,1], 2, 3, 4, '3E-Pi-B'],
		[[2,2,1,1], 1, 3, 4, '3E-Pi-L'],
		// H (U2-symmetric)
		[[2,1,2,1], 0, 3, 4, '3E-H-F'],
		[[2,1,2,1], 3, 3, 4, '3E-H-R'],
		// O (U-symmetric)
		[[0,0,0,0], 0, 3, 4, '3E-O-F'],
		// === 1 edge oriented ===
		// S
		[[2,0,2,2], 0, 1, 4, '1E-S-F'],
		[[2,0,2,2], 3, 1, 4, '1E-S-R'],
		[[2,0,2,2], 2, 1, 4, '1E-S-B'],
		[[2,0,2,2], 1, 1, 4, '1E-S-L'],
		// A
		[[0,1,1,1], 0, 1, 4, '1E-A-F'],
		[[0,1,1,1], 3, 1, 4, '1E-A-R'],
		[[0,1,1,1], 2, 1, 4, '1E-A-B'],
		[[0,1,1,1], 1, 1, 4, '1E-A-L'],
		// T
		[[0,0,1,2], 0, 1, 4, '1E-T-F'],
		[[0,0,1,2], 3, 1, 4, '1E-T-R'],
		[[0,0,1,2], 2, 1, 4, '1E-T-B'],
		[[0,0,1,2], 1, 1, 4, '1E-T-L'],
		// L
		[[0,1,0,2], 0, 1, 4, '1E-L-F'],
		[[0,1,0,2], 3, 1, 4, '1E-L-R'],
		[[0,1,0,2], 2, 1, 4, '1E-L-B'],
		[[0,1,0,2], 1, 1, 4, '1E-L-L'],
		// U
		[[0,0,2,1], 0, 1, 4, '1E-U-F'],
		[[0,0,2,1], 3, 1, 4, '1E-U-R'],
		[[0,0,2,1], 2, 1, 4, '1E-U-B'],
		[[0,0,2,1], 1, 1, 4, '1E-U-L'],
		// Pi
		[[2,2,1,1], 0, 1, 4, '1E-Pi-F'],
		[[2,2,1,1], 3, 1, 4, '1E-Pi-R'],
		[[2,2,1,1], 2, 1, 4, '1E-Pi-B'],
		[[2,2,1,1], 1, 1, 4, '1E-Pi-L'],
		// H (U2-symmetric)
		[[2,1,2,1], 0, 1, 4, '1E-H-F'],
		[[2,1,2,1], 3, 1, 4, '1E-H-R'],
		// O (U-symmetric)
		[[0,0,0,0], 0, 1, 4, '1E-O-F']
	];

	var pollprobs = mathlib.idxArray(poll_map, 3);
	var pollfilter = mathlib.idxArray(poll_map, 4);

	function getPOLLScramble(type, length, cases, neut) {
		var c = poll_map[scrMgr.fixCase(cases, pollprobs)];
		var co = c[0];
		var flipIdx = c[1];
		var nOriEdge = c[2];
		var eo = [];
		for (var i = 0; i < 4; i++) {
			eo[i] = (nOriEdge == 3) ? (i == flipIdx ? 1 : 0) : (i == flipIdx ? 0 : 1);
		}
		return get444LLScramble([-1,-1,-1,-1], eo, [-1,-1,-1,-1], co, neut, [0,1,2,3], [0,1,2,3], 0);
	}

	// 4x4 Plan-view image layout (32-char string):
	// Side strip rendering order (due to rotation math):
	//   F strip (rot=0): x=0 left, x=3 right
	//   R strip (rot=1): x=0 bottom, x=3 top
	//   B strip (rot=2): x=0 right, x=3 left
	//   L strip (rot=3): x=0 top, x=3 bottom
	//
	//              B[27] B[26] B[25] B[24]
	//     L[28]    U[0]  U[1]  U[2]  U[3]   R[23]
	//     L[29]    U[4]  U[5]  U[6]  U[7]   R[22]
	//     L[30]    U[8]  U[9]  U[10] U[11]  R[21]
	//     L[31]    U[12] U[13] U[14] U[15]  R[20]
	//              F[16] F[17] F[18] F[19]
	//
	// Corner yellow sticker positions: [U-face, CW-side, CCW-side]
	//   URF(co[0]): [15, 20, 19]   R[20]=bottom-R, F[19]=right-F
	//   UFL(co[1]): [12, 16, 31]   F[16]=left-F,   L[31]=bottom-L
	//   ULB(co[2]): [0,  28, 27]   L[28]=top-L,    B[27]=left-B
	//   UBR(co[3]): [3,  24, 23]   B[24]=right-B,  R[23]=top-R
	//
	// Edge yellow sticker positions (2 wings each): [U-face pair, side pair]
	//   UF(slot 0): U=[13,14], side=[17,18]
	//   UL(slot 1): U=[4,8],   side=[30,29]
	//   UB(slot 2): U=[1,2],   side=[26,25]
	//   UR(slot 3): U=[7,11],  side=[21,22]

	function getPOLLImage(cases, canvas) {
		var pollCornerPos4 = [
			[15, 20, 19],  // URF: U-face=15, CW=R[20], CCW=F[19]
			[12, 16, 31],  // UFL: U-face=12, CW=F[16], CCW=L[31]
			[0, 28, 27],   // ULB: U-face=0,  CW=L[28], CCW=B[27]
			[3, 24, 23]    // UBR: U-face=3,  CW=B[24], CCW=R[23]
		];
		var pollEdgeUPos4 = [[13, 14], [4, 8], [1, 2], [7, 11]];
		var pollEdgeSidePos4 = [[17, 18], [30, 29], [26, 25], [21, 22]];

		var pollCase = poll_map[cases];
		var co = pollCase[0];
		var flipIdx = pollCase[1];
		var nOriEdge = pollCase[2];

		var face = [];
		for (var i = 0; i < 32; i++) {
			face[i] = 'G';
		}
		// 4 center stickers always yellow
		face[5] = 'D';
		face[6] = 'D';
		face[9] = 'D';
		face[10] = 'D';

		// Set corner stickers based on CO
		for (var c = 0; c < 4; c++) {
			face[pollCornerPos4[c][co[c]]] = 'D';
		}

		// Set edge stickers based on flip (both wings of each dedge)
		for (var e = 0; e < 4; e++) {
			var isFlipped;
			if (nOriEdge == 3) {
				isFlipped = (e == flipIdx);
			} else {
				isFlipped = (e != flipIdx);
			}
			var uPair = pollEdgeUPos4[e];
			var sPair = pollEdgeSidePos4[e];
			if (isFlipped) {
				face[sPair[0]] = 'D';
				face[sPair[1]] = 'D';
			} else {
				face[uPair[0]] = 'D';
				face[uPair[1]] = 'D';
			}
		}

		var llParam = [face.join(''), null];
		if (!canvas) {
			return llParam.concat([pollfilter[cases]]);
		}
		image.llImage.drawImage(llParam[0], llParam[1], canvas);
	}

	scrMgr.reg('444wca', getRandomScramble)
		('4edge', getEdgeScramble)
		('444edo', getEdgeOnlyScramble)
		('444cto', getCenterOnlyScramble)
		('444ll', getLastLayerScramble)
		('444ell', getELLScramble)
		('444ctud', getCenterUDSolvedScramble)
		('444ctrl', getCenterRLSolvedScramble)
		('444l8e', getLast8DedgeScramble)
		('444ud3c', getYauUD3CScramble)
		('444rlda', getHoyaRLDAScramble)
		('444rlca', getHoyaRLCAScramble)
		('444ppll', getPPLLScramble, [ppllfilter, ppllprobs, getPPLLImage])
		('444poll', getPOLLScramble, [pollfilter, pollprobs, getPOLLImage])
	;

	return {
		init: init,
		getRandomScramble: getRandomScramble,
		getPartialScramble: getPartialScramble,
		testbench: testbench
	}
})(mathlib.Cnk, mathlib.circle);


export function setSolverProgressCallback(callback) {
    globalThis.__444_PROGRESS__ = typeof callback === "function" ? callback : null;
}

export function initFourByFourSolver() {
    scramble_444.init();
}

export function generateFourByFourScramble() {
    return scramble_444.getRandomScramble();
}
