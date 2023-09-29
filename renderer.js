"use strict";

class Renderer {

	constructor() {
		this.gl = null
		this.program = null
		this.locations = null
		this.pos_buffer = null
		this.tex_buffer = null
		this.array = null
	}

	init(canvas) {

		this.gl = canvas.getContext("webgl2")

		const gl = this.gl
		gl.enable(gl.BLEND)
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
	
		console.log(gl.getParameter(gl.VERSION))
		console.log(gl.getParameter(gl.SHADING_LANGUAGE_VERSION))

		this.buffer = gl.createBuffer()
	}

	draw(draw_configurations) {
		
		const gl = this.gl
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)		// clear screen

		gl.useProgram(this.program)

		gl.uniform2f(this.locations.u_screensize.location, canvas.width, canvas.height)

		gl.activeTexture(gl.TEXTURE0)
		gl.uniform1i(this.locations.u_texture.location, 0)

		gl.uniform2f(this.locations.u_displacement.location, 0, 0)


		gl.bindBuffer(gl.ARRAY_BUFFER, this.pos_buffer)
		// gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW)
		gl.enableVertexAttribArray(this.locations.a_position.location)
		gl.vertexAttribPointer(this.locations.a_position.location, 3, gl.FLOAT, false, 0, 0)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.tex_buffer)
		// gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.texcoords), gl.STATIC_DRAW)
		gl.enableVertexAttribArray(this.locations.a_texcoord.location)
		gl.vertexAttribPointer(this.locations.a_texcoord.location, 2, gl.FLOAT, false, 0, 0)

		for(const conf of draw_configurations) {
			gl.bindTexture(gl.TEXTURE_2D, conf.texture)
			gl.drawArrays(gl.TRIANGLES, conf.offset/3, conf.length/3)		// run our program by drawing points (one for now)
		}


		// draw player
		gl.bindBuffer(gl.ARRAY_BUFFER, player.pos_buffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(player.geometry.positions), gl.DYNAMIC_DRAW)
		gl.enableVertexAttribArray(this.locations.a_position.location)
		gl.vertexAttribPointer(this.locations.a_position.location, 3, gl.FLOAT, false, 0, 0)

		gl.bindBuffer(gl.ARRAY_BUFFER, player.tex_buffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(player.geometry.texcoords), gl.DYNAMIC_DRAW)
		gl.enableVertexAttribArray(this.locations.a_texcoord.location)
		gl.vertexAttribPointer(this.locations.a_texcoord.location, 2, gl.FLOAT, false, 0, 0)

		const texture_id = textures.get("elf.png").id
		gl.bindTexture(gl.TEXTURE_2D, texture_id)
		gl.drawArrays(gl.TRIANGLES, 0, 6)

		gl.flush()
	}
	
	program_create(vert_shader_source, frag_shader_source) {

		const gl = this.gl

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
	
		this.program = gl.createProgram()
		gl.attachShader(this.program, vertex_shader)
		gl.attachShader(this.program, fragment_shader)
		gl.linkProgram(this.program)
	
		status = gl.getProgramParameter(this.program, gl.LINK_STATUS)
		if (!status) {
			console.error(`Couldn't link shader program!\n${gl.getProgramInfoLog(this.program)}`)
			return null
		}

		this.program_get_locations()
	}

	program_get_locations() {

		const gl = this.gl

		this.locations = {}

		let count = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES)
		for(let i=0; i < count; i++) {
			const details = gl.getActiveAttrib(this.program, i)
			const location = gl.getAttribLocation(this.program, details.name)
			this.locations[details.name] = location
		}

		count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS)
		for(let i=0; i < count; i++) {
			const details = gl.getActiveUniform(this.program, i)
			const location = gl.getUniformLocation(this.program, details.name)			
			this.locations[details.name] = location
		}
	}

	push_data(data) {
		// { tag:"", prog:"", texture:"", data:[] }

		const gl = this.gl
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
	}

	texture_create(image) {

		const gl  = this.gl

		const texture = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, texture)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
	
		return texture
	}
}