
// make a texture manager to create webgl textures

let mdl = null
const textures = new Map()		// { source: source, image: image, id: 0 }
let buffer_info = []			// { tag: "", texture: "", offset: geometry_index/VER_SIZE, length: buffer.length/VER_SIZE }

let m_world = glMatrix.mat4.create()
let m_view = glMatrix.mat4.create()
let m_proj = glMatrix.mat4.create()

const CANVAS_W = 1920
const CANVAS_H = 1080

const POS_SIZE = 3 // 3 floats x, y, z
const TEX_SIZE = 2 // 2 floats u, v
const VER_SIZE = POS_SIZE + TEX_SIZE

const POS_SIZE_BYTE = POS_SIZE * 4
const TEX_SIZE_BYTE = TEX_SIZE * 4
const VER_SIZE_BYTE = VER_SIZE * 4

const SCALE = window.devicePixelRatio

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

	gl.enable(gl.DEPTH_TEST)
	gl.depthFunc(gl.LESS)

	gl.enable(gl.BLEND)
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

	console.log(gl.getParameter(gl.VERSION))
	console.log(gl.getParameter(gl.SHADING_LANGUAGE_VERSION))
	console.log(`devicePixelRatio: ${window.devicePixelRatio}`)

	const vert_shader_source = await fetch_text("shader-3d.vert")
	const frag_shader_source = await fetch_text("shader-3d.frag")
	
	renderer.program = shader_program_create(vert_shader_source, frag_shader_source)
	renderer.locations = shader_program_get_parameters(renderer.program)

	renderer.buffer_dyn = gl.createBuffer()
	renderer.buffer_sta = gl.createBuffer()

	mdl = await mdl_fetch("armor.mdl")
	geometry = mdl_buffer(mdl)

	glMatrix.mat4.identity(m_world);
	// glMatrix.mat4.rotate(m_world, m_world, glMatrix.glMatrix.toRadian(45), []);
	const eye		= [0,	0, 	-120]
	const center	= [0,	0,	   0]
	const up		= [0,	1,	   0]
	glMatrix.mat4.lookAt(m_view, eye, center, up);
	glMatrix.mat4.perspective(m_proj, glMatrix.glMatrix.toRadian(45), CANVAS_W / CANVAS_H, 1.0, 200.0);

	gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffer_sta)
	gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW)

	
	// create vao for static data
	renderer.vao_sta = gl.createVertexArray()
	gl.bindVertexArray(renderer.vao_sta)
	
	gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffer_sta)
	
	gl.enableVertexAttribArray(renderer.locations.a_position.location)
	gl.vertexAttribPointer(renderer.locations.a_position.location, POS_SIZE, gl.FLOAT, false, VER_SIZE_BYTE, 0)
	
	// gl.enableVertexAttribArray(renderer.locations.a_texcoord.location)
	// gl.vertexAttribPointer(renderer.locations.a_texcoord.location, TEX_SIZE, gl.FLOAT, false, VER_SIZE_BYTE, POS_SIZE_BYTE)
	gl.bindVertexArray(null)

	// create vao for dynamic data
	// renderer.vao_dyn = gl.createVertexArray()
	// gl.bindVertexArray(renderer.vao_dyn)

	// gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffer_dyn)

	// gl.enableVertexAttribArray(renderer.locations.a_position.location)
	// gl.vertexAttribPointer(renderer.locations.a_position.location, POS_SIZE, gl.FLOAT, false, VER_SIZE_BYTE, 0)

	// gl.enableVertexAttribArray(renderer.locations.a_texcoord.location)
	// gl.vertexAttribPointer(renderer.locations.a_texcoord.location, TEX_SIZE, gl.FLOAT, false, VER_SIZE_BYTE, POS_SIZE_BYTE)
	// gl.bindVertexArray(null)
	
	
	// create gl textures
	for(const [key, texture] of textures) {
		texture.id = texture_create(texture.image)
	}


	window.addEventListener("keydown", window_on_keydown)
	window.addEventListener("keyup", window_on_keyup)
	window.addEventListener("mousedown", window_on_mousedown)
	window.addEventListener("mouseup", window_on_mouseup)

	window.requestAnimationFrame(loop)
}


async function mdl_fetch(url) {
	// http://tfc.duke.free.fr/coding/mdl-specs-en.html
	const LITTLE_ENDIAN = true;

	const buffer = await fetch_buffer(url)

	const mdl = {
		header: null,
		skins: [],
		texcoords: [],
		triangles: [],
		frames: [],
		tex_id: [],
		iskin: 0
	}

	const header = {
		ident: 0,			/* magic number: "IDPO" */
		version: 0,			/* version: 6 */
	
		scale: [-1, -1, -1],			/* array 3 floats scale factor */
		translate: [-1, -1, -1],		/* array 3 floats translation vector */
		boundingradius: 0,
		eyeposition: [-1, -1, -1],		/* array 3 floats eyes' position */
	
		num_skins: 0,		/* number of textures */
		skinwidth: 0,		/* texture width */
		skinheight: 0,		/* texture height */
	
		num_verts: 0,		/* number of vertices */
		num_tris: 0,		/* number of triangles */
		num_frames: 0,		/* number of frames */
	
		synctype: 0,		/* 0 = synchron, 1 = random */
		flags: 0,			/* state flag */
		size: 0
	}

	let data_view = new DataView(buffer)

	// read header
	header.ident = data_view.getInt32(0, LITTLE_ENDIAN)
	header.version = data_view.getInt32(4, LITTLE_ENDIAN)
	header.scale[0] = data_view.getFloat32(8, LITTLE_ENDIAN)
	header.scale[1] = data_view.getFloat32(12, LITTLE_ENDIAN)
	header.scale[2] = data_view.getFloat32(16, LITTLE_ENDIAN)
	header.translate[0] = data_view.getFloat32(20, LITTLE_ENDIAN)
	header.translate[1] = data_view.getFloat32(24, LITTLE_ENDIAN)
	header.translate[2] = data_view.getFloat32(28, LITTLE_ENDIAN)
	header.boundingradius = data_view.getFloat32(32, LITTLE_ENDIAN)
	header.eyeposition[0] = data_view.getFloat32(36, LITTLE_ENDIAN)
	header.eyeposition[1] = data_view.getFloat32(40, LITTLE_ENDIAN)
	header.eyeposition[2] = data_view.getFloat32(44, LITTLE_ENDIAN)
	header.num_skins = data_view.getInt32(48, LITTLE_ENDIAN)
	header.skinwidth = data_view.getInt32(52, LITTLE_ENDIAN)
	header.skinheight = data_view.getInt32(56, LITTLE_ENDIAN)
	header.num_verts = data_view.getInt32(60, LITTLE_ENDIAN)
	header.num_tris = data_view.getInt32(64, LITTLE_ENDIAN)
	header.num_frames = data_view.getInt32(68, LITTLE_ENDIAN)
	header.synctype = data_view.getInt32(72, LITTLE_ENDIAN)
	header.flags = data_view.getInt32(76, LITTLE_ENDIAN)
	header.size = data_view.getFloat32(80, LITTLE_ENDIAN)

	mdl.header = header
	let offset = 84		// header size in bytes
	
	const SKIN_SIZE =  1 * 4 + header.skinwidth * header.skinheight
	// Read texture data
	// struct mdl_skin_t { int group; GLubyte *data; };
	for(let i=0; i<header.num_skins; i++) {

		// load skins
		const skin = { group: 0, data: null}
		skin.group = data_view.getInt32(offset + i * SKIN_SIZE + 0, LITTLE_ENDIAN)

		const offset2 = offset +  i * SKIN_SIZE + 4
		skin.data = new Int8Array(buffer, offset2, header.skinwidth * header.skinheight)
		mdl.skins.push(skin)
		// mdl->tex_id[i] = MakeTextureFromSkin (i, mdl); ????
	}
	offset += header.num_skins * SKIN_SIZE
	
	// Read tex coords
	// struct mdl_texcoord_t { int onseam; int s; int t; };
	const TEXCOORD_SIZE =  3 * 4

	for(let i=0; i<header.num_verts; i++) {
		const texcoord = {
			onseam: data_view.getInt32(offset + i * TEXCOORD_SIZE + 0, LITTLE_ENDIAN),
			u: data_view.getInt32(offset + i * TEXCOORD_SIZE + 4, LITTLE_ENDIAN),
			v: data_view.getInt32(offset + i * TEXCOORD_SIZE + 8, LITTLE_ENDIAN)
		}
		mdl.texcoords.push(texcoord)
	}
	offset += header.num_verts * TEXCOORD_SIZE

	// Read triangles
	const TRIANGLE_SIZE =  4 * 4
	// struct mdl_triangle_t { int facesfront; int vertex[3]; };	
	for(let i=0; i<header.num_tris; i++) {
		const triangle = {
			facesfront: data_view.getInt32(offset + i * TRIANGLE_SIZE + 0, LITTLE_ENDIAN),
			vi1: data_view.getInt32(offset + i * TRIANGLE_SIZE + 4, LITTLE_ENDIAN),
			vi2: data_view.getInt32(offset + i * TRIANGLE_SIZE + 8, LITTLE_ENDIAN),
			vi3: data_view.getInt32(offset + i * TRIANGLE_SIZE + 12, LITTLE_ENDIAN)
		}
		mdl.triangles.push(triangle)
	}
	offset += header.num_tris * TRIANGLE_SIZE

	// Read frames
	const VERTEX_SIZE = 4
	// struct mdl_vertex_t { unsigned char v[3]; unsigned char normalIndex; };
	const FRAME_SIZE = 4 + 4 + 4 + 16 + header.num_verts * 4
	// struct mdl_frame_t { int type; struct mdl_simpleframe_t frame; };
	// struct mdl_simpleframe_t { struct mdl_vertex_t bboxmin; struct mdl_vertex_t bboxmax; char name[16]; struct mdl_vertex_t *verts; };
	for (let i=0; i<header.num_frames; i++) {

		const mdl_frame = { type: 0, frame: null }
		const simple_frame = { bboxmin: [], bboxmax: [], name: "", verts: [] }

		mdl_frame.type = data_view.getInt32(offset + i * FRAME_SIZE + 0, LITTLE_ENDIAN)

		const min_vertex = { 
			x: data_view.getUint8(offset + i * FRAME_SIZE + 4, LITTLE_ENDIAN), 
			y: data_view.getUint8(offset + i * FRAME_SIZE + 5, LITTLE_ENDIAN), 
			z: data_view.getUint8(offset + i * FRAME_SIZE + 6, LITTLE_ENDIAN), 
			normal_index: data_view.getUint8(offset + i * FRAME_SIZE + 7, LITTLE_ENDIAN)
		}
		simple_frame.bboxmin = min_vertex

		const max_vertex = { 
			x: data_view.getUint8(offset + i * FRAME_SIZE + 8, LITTLE_ENDIAN), 
			y: data_view.getUint8(offset + i * FRAME_SIZE + 9, LITTLE_ENDIAN), 
			z: data_view.getUint8(offset + i * FRAME_SIZE + 10, LITTLE_ENDIAN), 
			normal_index: data_view.getUint8(offset + i * FRAME_SIZE + 11, LITTLE_ENDIAN)
		}
		simple_frame.bboxmax = max_vertex
		
		let j = 0
		let c = ""
		while(j<16 && c!=="\u0000") {
			simple_frame.name += c
			c = String.fromCharCode(data_view.getUint8(offset + i * FRAME_SIZE + 12 + j, LITTLE_ENDIAN))
			j++
		}

		for(let j=0; j<header.num_verts; j++) {
			const vertex = {
				x: data_view.getUint8(offset + i * FRAME_SIZE + 28 + j * 4, LITTLE_ENDIAN), 
				y: data_view.getUint8(offset + i * FRAME_SIZE + 29 + j * 4, LITTLE_ENDIAN), 
				z: data_view.getUint8(offset + i * FRAME_SIZE + 30 + j * 4, LITTLE_ENDIAN), 
				normal_index: data_view.getUint8(offset + i * FRAME_SIZE + 31 + j * 4, LITTLE_ENDIAN)
			}
			simple_frame.verts.push(vertex)
		}
		mdl_frame.frame = simple_frame
		mdl.frames.push(mdl_frame)
	}

	console.log(mdl)
	return mdl
}


function mdl_buffer(mdl) {

	const count = mdl.header.num_tris * 3 * VER_SIZE
	const geometry = new Float32Array(count)
	for(let i=0; i<mdl.header.num_tris; i++) {

		const offset = i * (3 * VER_SIZE)
		const vi1 = mdl.triangles[i].vi1
		const v1 = mdl.frames[0].frame.verts[vi1]
		geometry[offset + 0] = (v1.x * mdl.header.scale[0]) + mdl.header.translate[0]
		geometry[offset + 1] = (v1.y * mdl.header.scale[1]) + mdl.header.translate[1]
		geometry[offset + 2] = (v1.z * mdl.header.scale[2]) + mdl.header.translate[2]

		geometry[offset + 3] = 0
		geometry[offset + 4] = 0

		const vi2 = mdl.triangles[i].vi2
		const v2 = mdl.frames[0].frame.verts[vi2]
		geometry[offset + 5] = (v2.x * mdl.header.scale[0]) + mdl.header.translate[0]
		geometry[offset + 6] = (v2.y * mdl.header.scale[1]) + mdl.header.translate[1]
		geometry[offset + 7] = (v2.z * mdl.header.scale[2]) + mdl.header.translate[2]

		geometry[offset + 8] = 0
		geometry[offset + 9] = 0

		const vi3 = mdl.triangles[i].vi3
		const v3 = mdl.frames[0].frame.verts[vi3]
		geometry[offset + 10] = (v3.x * mdl.header.scale[0]) + mdl.header.translate[0]
		geometry[offset + 11] = (v3.y * mdl.header.scale[1]) + mdl.header.translate[1]
		geometry[offset + 12] = (v3.z * mdl.header.scale[2]) + mdl.header.translate[2]

		geometry[offset + 13] = 0
		geometry[offset + 14] = 0

		// console.log((v1.x * mdl.header.scale[0]) + mdl.header.translate[0], (v1.y * mdl.header.scale[1]) + mdl.header.translate[1], (v1.z * mdl.header.scale[2]) + mdl.header.translate[2])
		// console.log((v2.x * mdl.header.scale[0]) + mdl.header.translate[0], (v2.y * mdl.header.scale[1]) + mdl.header.translate[1], (v2.z * mdl.header.scale[2]) + mdl.header.translate[2])
		// console.log((v3.x * mdl.header.scale[0]) + mdl.header.translate[0], (v3.y * mdl.header.scale[1]) + mdl.header.translate[1], (v3.z * mdl.header.scale[2]) + mdl.header.translate[2])
	}

	return geometry
}


function loop(timestamp) {

	// process_input();
	draw()

	window.requestAnimationFrame(loop)
}


function draw() {

	const gl = renderer.gl

	gl.viewport(0, 0, renderer.canvas.width, renderer.canvas.height);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)		// clear screen

	gl.useProgram(renderer.program)

	// gl.activeTexture(gl.TEXTURE0)

	gl.uniformMatrix4fv(renderer.locations.u_matrix_world.location, gl.FALSE, m_world)
	gl.uniformMatrix4fv(renderer.locations.u_matrix_view.location, gl.FALSE, m_view)
	gl.uniformMatrix4fv(renderer.locations.u_matrix_proj.location, gl.FALSE, m_proj)
	// gl.uniform1i(renderer.locations.u_texture.location, 0)


	gl.bindVertexArray(renderer.vao_sta)

	gl.drawArrays(gl.TRIANGLES, 0, mdl.header.num_tris * 3)

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


async function fetch_text(url) {
	try {
		let response = await fetch(url)
		const text = await response.text()
		return text
	}
	catch(error) { console.log(error.message); };
}


async function fetch_buffer(url) {

	try {
		let response = await fetch(url);
		let buffer = await response.arrayBuffer();
		return buffer;
	}
	catch(error) { console.log(error.message); };
}