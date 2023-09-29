
// make a texture manager to create webgl textures

let level = null
const textures = new Map()
let buffer_info = []

const STATE = {
	NONE:		0,
	IDLE:		1,
	MOVE:		2,
	JUMP:		4,
	FALL:		8,
	ROLL:		16,
	ATTACK1:	32,
	ATTACK2:	64,
	ATTACK3:	128
}

const CANVAS_W = 1920
const CANVAS_H = 1080

const POS_SIZE = 3 // 3 floats x, y, z
const TEX_SIZE = 2 // 2 floats u, v
const VER_SIZE = POS_SIZE + TEX_SIZE

const POS_SIZE_BYTE = POS_SIZE * 4
const TEX_SIZE_BYTE = TEX_SIZE * 4
const VER_SIZE_BYTE = VER_SIZE * 4

const ANIMATION_DTIME = 83
const JUMP_DURATION = 22 * ANIMATION_DTIME / 2	// 22 frames of 83ms
const JUMP_HEIGHT = 64 * 3.5
const ROLL_DURATION = 8 * ANIMATION_DTIME		// 8 frames of 83ms

const PLAYER_SCALE = 3
const PLAYER_PIXEL_TRIM = 4
const SCALE = window.devicePixelRatio

let animation_start_time = 0

const renderer = {
	canvas: null,
	gl: null,
	program: null,
	locations: null,
	buffer_sta: null,
	vao_sta: null,
	buffer_dyn: null,
	vao_dyn: null
}

let input = {
	left: false,
	right: false,
	up: false,
	down: false,
	jump: false,
	roll: false,
	attack1: false,
	attack2: false,
	attack3: false
}

const player = {
	x: 220,
	y: 384,
	state: STATE.IDLE,
	special: "",
	going_up: true,
	texture: null,
	jump_reset: false,
	jump_floor: 0,
	animations: null,
	geometry: null
}


init()


async function init() {

	renderer.canvas = document.getElementById("display")
	renderer.gl = renderer.canvas.getContext("webgl2")

	if(SCALE !== 1) {
		renderer.canvas.style.width = `${CANVAS_W/SCALE}px`
		renderer.canvas.style.height = `${CANVAS_H/SCALE}px`
	}

	renderer.canvas.addEventListener("contextmenu", canvas_on_context)	

	const gl = renderer.gl

	gl.enable(gl.BLEND)
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

	console.log(gl.getParameter(gl.VERSION))
	console.log(gl.getParameter(gl.SHADING_LANGUAGE_VERSION))
	console.log(`devicePixelRatio: ${window.devicePixelRatio}`)

	const vert_shader_source = await fetch_text("shader.vert")
	const frag_shader_source = await fetch_text("shader.frag")
	
	renderer.program = shader_program_create(vert_shader_source, frag_shader_source)
	renderer.locations = shader_program_get_parameters(renderer.program)

	level = await tiled_fetch("resources/level-village.json")
	const geometry = level_geometry_generate(level)
	buffer_info = geometry.info

	renderer.buffer_dyn = gl.createBuffer()
	renderer.buffer_sta = gl.createBuffer()

	gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffer_sta)
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.data), gl.STATIC_DRAW)

	
	// create vao for static data
	renderer.vao_sta = gl.createVertexArray()
	gl.bindVertexArray(renderer.vao_sta)
	
	gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffer_sta)
	
	gl.enableVertexAttribArray(renderer.locations.a_position.location)
	gl.vertexAttribPointer(renderer.locations.a_position.location, POS_SIZE, gl.FLOAT, false, VER_SIZE_BYTE, 0)
	
	gl.enableVertexAttribArray(renderer.locations.a_texcoord.location)
	gl.vertexAttribPointer(renderer.locations.a_texcoord.location, TEX_SIZE, gl.FLOAT, false, VER_SIZE_BYTE, POS_SIZE_BYTE)
	gl.bindVertexArray(null)

	// create vao for dynamic data
	renderer.vao_dyn = gl.createVertexArray()
	gl.bindVertexArray(renderer.vao_dyn)

	gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffer_dyn)

	gl.enableVertexAttribArray(renderer.locations.a_position.location)
	gl.vertexAttribPointer(renderer.locations.a_position.location, POS_SIZE, gl.FLOAT, false, VER_SIZE_BYTE, 0)

	gl.enableVertexAttribArray(renderer.locations.a_texcoord.location)
	gl.vertexAttribPointer(renderer.locations.a_texcoord.location, TEX_SIZE, gl.FLOAT, false, VER_SIZE_BYTE, POS_SIZE_BYTE)
	gl.bindVertexArray(null)
	
	player.animations = await aseprite_fetch("resources/elf.json")		//loaded as a script src in the HTML (index.html)
	const texture = textures.get(player.animations.meta.image)
	player.texture = texture

	
	// create gl textures
	for(const [key, texture] of textures) {
		texture.id = texture_create(texture.image)
	}


	animation_start_time = Date.now()

	window.addEventListener("keydown", window_on_keydown)
	window.addEventListener("keyup", window_on_keyup)
	window.addEventListener("mousedown", window_on_mousedown)
	window.addEventListener("mouseup", window_on_mouseup)

	window.requestAnimationFrame(loop)
}


async function tiled_fetch(url) {

	let response = await fetch(url);
	const level = await response.json();

	for(const ts of level.tilesets) {

		const source = ts.image
		const image = await fetch_image("resources/" + source)
		// const id = texture_create(image)
		textures.set(source, { source: source, image: image, id: 0 })
	}

	for(const layer of level.layers) {
		if(layer.type === "imagelayer") {
			const source = layer.image
			const image = await fetch_image("resources/" + source)
			// const id = texture_create(image)
			textures.set(source, { source: source, image: image, id: 0 })
		}
	}

	return level
}


async function aseprite_fetch(url) {

	let response = await fetch(url);
	const sprite = await response.json();

	const source = sprite.meta.image
	const image = await fetch_image("resources/" + source)
	// const id = texture_create(image)
	textures.set(source, { source: source, image: image, id: 0 })

	return sprite
}


function level_geometry_generate(level) {

	const geometry = { info:[], data: null }
	geometry.data = new Float32Array(level_geometry_count(level))
	geometry_index = 0
	geometry_offset = 0

	const positions_by_texture = new Array(level.tilesets.length)
	for(let i=0; i<positions_by_texture.length; i++) {
		positions_by_texture[i] = []
	}

	for(let i=0; i<level.layers.length; i++) {

		if(level.layers[i].name === "collision") continue

		const layer = level.layers[i]
		const z = (level.layers.length - i) / level.layers.length

		// image layer
		if(layer.type === "imagelayer") {

			const tex = textures.get(layer.image)
			const iw = tex.image.width
			const ih = tex.image.height

			const buffer = [
				layer.x, 	layer.y,	z,	0,	0,
				layer.x, 	layer.y+ih,	z,	0,	1,
				layer.x+iw,	layer.y+ih,	z,	1,	1,
				layer.x+iw,	layer.y+ih,	z,	1,	1,
				layer.x+iw,	layer.y,	z,	1,	0,
				layer.x, 	layer.y,	z,	0,	0
			]
			
			geometry.info.push({ tag: `layer${i}0`, texture: tex, offset: geometry_index/VER_SIZE, length: buffer.length/VER_SIZE })
			for(let i=0; i<buffer.length; i++) {
				geometry.data[geometry_index] = buffer[i]
				geometry_index++
			}
		}
		//tile layer
		else if(layer.type === "tilelayer") {

			const th = level.tileheight
			const tw = level.tilewidth

			for(let i=0; i<layer.data.length; i++) {

				let tile = layer.data[i]
				if(tile === 0) continue

				// find texture index
				let tsi
				for(tsi=0; tsi<level.tilesets.length; tsi++) {
					if(tile < level.tilesets[tsi].firstgid) {
						break;
					}
				}
				tsi--

				// generate geometry
				const col = i % level.width
				const row = Math.floor(i / level.width)
				const x = col * tw
				const y = row * th

				tile = tile - level.tilesets[tsi].firstgid 
				const u  = (tile % level.tilesets[tsi].columns) / level.tilesets[tsi].columns
				const v  = Math.floor(tile / level.tilesets[tsi].columns) / (level.tilesets[tsi].imageheight / level.tilesets[tsi].tileheight)
				const s = level.tilesets[tsi].tilewidth / level.tilesets[tsi].imagewidth
				const t = level.tilesets[tsi].tileheight / level.tilesets[tsi].imageheight

				positions_by_texture[tsi].push(
					x,		y,		z, u,		v,
					x,		y+th,	z, u, 		v+t,
					x+tw,	y+th,	z, u+s,		v+t,
					x+tw,	y+th,	z, u+s,		v+t,
					x+tw,	y,		z, u+s,		v,
					x,		y,		z, u, 		v
				)
			}
			
			// sequence data per texture
			for(let tsi=0; tsi<positions_by_texture.length; tsi++) {

				const buffer = positions_by_texture[tsi]
				const tex = textures.get(level.tilesets[tsi].image)
				geometry.info.push({ tag: `layer${i}${tsi}`, texture: tex, offset: geometry_index/VER_SIZE, length: buffer.length/VER_SIZE })
				for(let i=0; i<buffer.length; i++) {
					geometry.data[geometry_index] = buffer[i]
					geometry_index++
				}
			}
			
			for(let i=0; i<positions_by_texture.length; i++) {
				positions_by_texture[i] = []
			}
		}
	}

	return geometry
}


function level_geometry_count(level) {

	let count = 0

	for(let i=0; i<level.layers.length; i++) {

		const layer = level.layers[i]
		if(layer.name === "collision") continue

		if(layer.type === "imagelayer") {
			count += VER_SIZE * 6
		}
		else if(layer.type === "tilelayer") {
			for(let i=0; i<layer.data.length; i++) {
				let tile = layer.data[i]
				if(tile === 0) continue
				count += VER_SIZE * 6
			}
		}
	}

	return count
}


function player_geometry_generate(player, frame) {

	if(player.geometry === null) {
		player.geometry = new Float32Array(VER_SIZE * 6)
	}

	const x0 = player.x - (frame.w * PLAYER_SCALE / 2)
	const y0 = player.y - (frame.h - PLAYER_PIXEL_TRIM) * PLAYER_SCALE
	const z0 = 0
	const x1 = player.x + (frame.w * PLAYER_SCALE / 2)
	const y1 = player.y + PLAYER_PIXEL_TRIM

	const u = frame.x / player.texture.image.width
	const v = frame.y / player.texture.image.height
	const s = frame.w / player.texture.image.width
	const t = frame.h / player.texture.image.height

	const r = (player.special === "reversed" ? 1 : 0)
	const b = 1 - r

	const geometry = [
		x0,	y0,	z0, u+s*r, v,
		x0,	y1,	z0, u+s*r, v+t,
		x1,	y1,	z0, u+s*b, v+t,

		x1,	y1,	z0, u+s*b, v+t,
		x1,	y0,	z0, u+s*b, v, 
		x0,	y0,	z0, u+s*r, v,
	]
	
	for(let i=0; i<geometry.length; i++) {
		player.geometry[i] = geometry[i]
	}

	return player.geometry
}


function player_animation_calc(player) {

	let tag = "idle"
	let animation_time = ANIMATION_DTIME


	if(player.state & STATE.FALL) {
		tag = "j_down"
	}
	else if(player.state & STATE.JUMP) {
		tag = "jump"
		animation_time /=  2
	}
	else if(player.state & STATE.ROLL) {
		tag = "roll"
	}
	else if(player.state & STATE.MOVE) {
		tag = "run"
	}
	else if(player.state & STATE.ATTACK1) {
		tag = "1_atk"
	}
	else if(player.state & STATE.ATTACK2) {
		tag = "2_atk"
	}
	else if(player.state & STATE.ATTACK3) {
		tag = "3_atk"
	}
	else if(player.state & STATE.IDLE) {
		tag = "idle"
	}

	let frame_count = 0
	let frame_from = 0
	for(const frame_stats of player.animations.meta.frameTags) {
		if(frame_stats.name === tag) {
			frame_count = frame_stats.to - frame_stats.from + 1
			frame_from = frame_stats.from
			break
		}
	}

	const frame_index = frame_from + Math.floor((Date.now() - animation_start_time) / animation_time) % frame_count
	const frame = player.animations.frames[frame_index].frame

	return frame
}


function loop(timestamp) {

	// process key down/up and mouse down/up and set player.state
	process_input();
	// debug_state(player.state);

	// update player position, detect collision, etc
	// this has to be done before calculation animation frame
	// in case this changes the player.state
	// check fall
	let collision_tiles = null
	for(const layer of level.layers) {
		if(layer.name === "collision") {
			collision_tiles = layer.data
			break
		}
	}

	if(player.state & STATE.JUMP) {

		const y = calc_jump(animation_start_time, JUMP_HEIGHT, JUMP_DURATION)
		let current_dy = player.y;
		let new_dy = player.jump_floor - y;
		player.y = player.jump_floor - y

		if (current_dy < new_dy) {
			player.going_up = false;
			// console.log("going down")
		}
		else {
			player.going_up = true;
			// console.log("going up")
		}

		let tile_index = calc_tile_index(player.x, player.y + level.tileheight/2, level.tilewidth, level.tileheight, level.width);
		// let tiles = level.layers[0].data;

		if (collision_tiles[tile_index] !== 0 && player.going_up === false) {
			player.y = Math.floor(tile_index / level.width) * level.tileheight;
			player.jump_floor = player.y
			player.state = player.state ^ STATE.JUMP;
			player.going_up = true;
		}
	}
	if(player.state & STATE.ROLL) {

		if(Date.now() - animation_start_time < ROLL_DURATION) {
			if (player.special === "reversed") {
				player.x = player.x - 3
			}
			else {
				player.x = player.x + 3
			}		
		}
		else {
			player.state = player.state ^ STATE.ROLL;
		}
	}
	else if(player.state & STATE.MOVE) {
		if (player.special === "reversed") {
			player.x = player.x - 3
		}
		else {
			player.x = player.x + 3
		}
	}

	if(collision_tiles !== null) {
		let tile_index = calc_tile_index(player.x, player.y + 1, level.tilewidth, level.tileheight, level.width);
		if ( (typeof collision_tiles[tile_index] === "undefined" || collision_tiles[tile_index] === 0) && !(player.state & STATE.JUMP)) {
			if(!(player.state & STATE.FALL)) {
				player.state = player.state | STATE.FALL;
				animation_start_time = Date.now()
			}
		}
		
		if(player.state & STATE.FALL) {
	
			player.y = player.y + 6;
	
			let tile_index = calc_tile_index(player.x, player.y, level.tilewidth, level.tileheight, level.width);
			if (typeof collision_tiles[tile_index] !== "undefined" && collision_tiles[tile_index] !== 0) {
				if(player.state & STATE.FALL) {
					player.state = player.state ^ STATE.FALL;
					player.y = Math.floor(player.y / level.tileheight) * level.tileheight
					player.jump_floor = player.y
				}
			}
		}
	}


	// figure out which frame to draw
	const player_frame = player_animation_calc(player)
	player_geometry_generate(player, player_frame)

	draw()

	window.requestAnimationFrame(loop)
}


function draw() {

	const gl = renderer.gl

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)		// clear screen

	gl.useProgram(renderer.program)

	gl.activeTexture(gl.TEXTURE0)

	gl.uniform2f(renderer.locations.u_screensize.location, renderer.canvas.width, renderer.canvas.height)
	gl.uniform1i(renderer.locations.u_texture.location, 0)
	gl.uniform2f(renderer.locations.u_displacement.location, 0, 0)

	gl.bindVertexArray(renderer.vao_sta)

	for(const conf of buffer_info) {
		gl.bindTexture(gl.TEXTURE_2D, conf.texture.id)
		gl.drawArrays(gl.TRIANGLES, conf.offset, conf.length)		// run our program by drawing points (one for now)
	}

	gl.bindVertexArray(null)

	// draw player
	gl.bindVertexArray(renderer.vao_dyn)
	gl.bufferData(gl.ARRAY_BUFFER, player.geometry, gl.DYNAMIC_DRAW)
	gl.bindTexture(gl.TEXTURE_2D, player.texture.id)

	gl.drawArrays(gl.TRIANGLES, 0, 6)
	gl.bindVertexArray(null)

	gl.flush()
}


function texture_create(image) {

	const gl = renderer.gl
	const texture = gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D, texture)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)

	return texture
}


function shader_program_create(vert_shader_source, frag_shader_source) {

	const gl = renderer.gl
	const vertex_shader = gl.createShader(gl.VERTEX_SHADER)
	gl.shaderSource(vertex_shader, vert_shader_source)
	gl.compileShader(vertex_shader)

	let status = gl.getShaderParameter(vertex_shader, gl.COMPILE_STATUS)
	if (!status) {
		console.error(`Couldn't compile vertex shader!\n${gl.getShaderInfoLog(vertex_shader)}`)
		return null
	}

	const fragment_shader = gl.createShader(gl.FRAGMENT_SHADER)
	gl.shaderSource(fragment_shader, frag_shader_source)
	gl.compileShader(fragment_shader)

	status = gl.getShaderParameter(fragment_shader, gl.COMPILE_STATUS)
	if (!status) {
		console.error(`Couldn't compile fragment shader!\n${gl.getShaderInfoLog(fragment_shader)}`)
		return null
	}

	const program = gl.createProgram()
	gl.attachShader(program, vertex_shader)
	gl.attachShader(program, fragment_shader)
	gl.linkProgram(program)

	status = gl.getProgramParameter(program, gl.LINK_STATUS)
	if (!status) {
		console.error(`Couldn't link shader program!\n${gl.getProgramInfoLog(program)}`)
		return null
	}

	return program;
}


function shader_program_get_parameters(program) {

	const gl = renderer.gl
	const parameters = {}

	let count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
	for(let i=0; i<count; i++) {
		let details = gl.getActiveUniform(program, i)
		let location = gl.getUniformLocation(program, details.name)		
		parameters[details.name] = {
			location : location,
			type : details.type
		}
	}
	
	count = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
	for(let i=0; i<count; i++) {
		let details = gl.getActiveAttrib(program, i)
		let location = gl.getAttribLocation(program, details.name)
		parameters[details.name] = {
			location : location,
			type : details.type
		}
	}

	return parameters
}


function process_input() {

	// jump
	if(input.jump) {
		if(player.jump_reset && !(player.state & STATE.JUMP)) {
			player.state = player.state | STATE.JUMP
			animation_start_time = Date.now()
			player.jump_reset = false
		}
	}
	else if(!input.jump) {
		if(!(player.state & STATE.JUMP)) {
			player.jump_reset = true
		}
	}

	// roll
	if( (input.down && input.left) || (input.down && input.right) ) {
		if(!(player.state & STATE.ROLL)) {
			player.state = player.state | STATE.ROLL
			if(!(player.state & STATE.JUMP)) {
				animation_start_time = Date.now() 
			}
		}
	}
	else if(!input.down) {
		if(!(player.state & STATE.ROLL)) {
			player.jump_reset = true
		}
	}

	if(input.right & input.left) {
		if(player.state & STATE.MOVE) {
			player.state = player.state ^ STATE.MOVE
		}
		if(!(player.state & STATE.JUMP) && !(player.state & STATE.ROLL)) {
			animation_start_time = Date.now()    
		}
	}
	else if(input.right) {
		if(!(player.state & STATE.MOVE) || player.special !== "") {
			player.state = player.state | STATE.MOVE
			player.special = ""
			if(!(player.state & STATE.JUMP) && !(player.state & STATE.ROLL)) {
				animation_start_time = Date.now()    
			}
		}
	}
	else if(input.left) {
		if(!(player.state & STATE.MOVE) || player.special !== "reversed") {
			player.state = player.state | STATE.MOVE
			player.special = "reversed"
			if(!(player.state & STATE.JUMP) && !(player.state & STATE.ROLL)) {
				animation_start_time = Date.now()
			}
		}
	}
	else if(!input.right && !input.left) {
		if(player.state & STATE.MOVE) {
			player.state = player.state ^ STATE.MOVE
			if(!(player.state & STATE.JUMP) && !(player.state & STATE.ROLL)) {
				animation_start_time = Date.now() 
			}
		}
	}

	if(input.attack1) {
		if(!(player.state & STATE.ATTACK1)) {
			player.state = player.state | STATE.ATTACK1
			if(!(player.state & STATE.JUMP)) {
				animation_start_time = Date.now() 
			}
		}
	}
	else if(!input.attack1) {
		if(player.state & STATE.ATTACK1) {
			player.state = player.state ^ STATE.ATTACK1
			if(!(player.state & STATE.JUMP)) {
				animation_start_time = Date.now()
			}
		}
	}

	if(input.attack2) {
		if(!(player.state & STATE.ATTACK2)) {
			player.state = player.state | STATE.ATTACK2
			if(!(player.state & STATE.JUMP)) {
				animation_start_time = Date.now() 
			}
		}
	}
	else if(!input.attack2) {
		if(player.state & STATE.ATTACK2) {
			player.state = player.state ^ STATE.ATTACK2
			if(!(player.state & STATE.JUMP)) {
				animation_start_time = Date.now()
			}
		}
	}

	if(input.attack3) {
		if(!(player.state & STATE.ATTACK3)) {
			player.state = player.state | STATE.ATTACK3
			if(!(player.state & STATE.JUMP)) {
				animation_start_time = Date.now() 
			}
		}
	}
	else if(!input.attack3) {
		if(player.state & STATE.ATTACK3) {
			player.state = player.state ^ STATE.ATTACK3
			if(!(player.state & STATE.JUMP)) {
				animation_start_time = Date.now()
			}
		}
	}
}


function window_on_keydown(evt) {

	if(evt.key === "w") {
		input.up = true
	}
	else if(evt.key === "a") {
		input.left = true
	}
	else if(evt.key === "d") {
		input.right = true
	}
	else if(evt.key === "s") {
		input.down = true
	}
	else if(evt.key === " ") {
		input.jump = true
	}
	else if(evt.key === "e") {
		input.attack1 = true
	}
	else if(evt.key === "1" || evt.key === "q") {
		input.attack3 = true
	}
}


function window_on_keyup(evt) {

	if(evt.key === "w") {
		input.up = false
	}
	else if(evt.key === "a") {
		input.left = false
	}
	else if(evt.key === "d") {
		input.right = false
	}
	else if(evt.key === "s") {
		input.down = false
	}
	else if(evt.key === " ") {
		input.jump = false
	}
	else if(evt.key === "e") {
		input.attack1 = false
	}
	else if(evt.key === "1" || evt.key === "q") {
		input.attack3 = false
	}
}


function window_on_mousedown(evt) {
	if(evt.button === 0) {
		input.attack2 = true
	}
}


function window_on_mouseup(evt) {
	if(evt.button === 0) {
		input.attack2 = false
	}
}


function canvas_on_context(evt) {
	evt.preventDefault()
}


function calc_jump(stime, height, duration) {

	const const_x = Math.sqrt(height);

	let t = Date.now() - stime
	t = t - duration / 2
	t = t * const_x / (duration / 2);

	return height - t * t
}


function debug_state(state) {

	const states = []
	if(state & STATE.IDLE) {
		states.push("IDLE")
	}
	if(state & STATE.MOVE) {
		states.push("MOVE")
	}
	if(state & STATE.JUMP) {
		states.push("JUMP")
	}
	if(state & STATE.ROLL) {
		states.push("ROLL")
	}
	if(state & STATE.ATTACK1) {
		states.push("ATTACK1")
	}
	if(state & STATE.ATTACK2) {
		states.push("ATTACK2")
	}
	if(state & STATE.ATTACK3) {
		states.push("ATTACK3")
	}

	console.log(states.join(" | "))
}


function calc_tile_index(x, y, tw, th, lw) {

	const tile_index = Math.floor(x / tw) + Math.floor(y / th) * lw;
	return tile_index;
}


async function fetch_json(url) {
	let response = await fetch(url)
	const json = await response.json()
	return json
}

async function fetch_text(url) {
	let response = await fetch(url)
	const text = await response.text()
	return text
}

async function fetch_image(url) {
	return new Promise(resolve => {
		const image = new Image()
		image.addEventListener('load', () => resolve(image))
		image.src = url
	});
}