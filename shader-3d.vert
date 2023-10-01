#version 300 es

uniform mat4 u_matrix_world;
uniform mat4 u_matrix_view;
uniform mat4 u_matrix_proj;
in vec3 a_position;
in vec2 a_texcoord;
out vec2 v_texcoord;

void main(){
    gl_Position = u_matrix_proj * u_matrix_view * u_matrix_world * vec4(a_position, 1.0);
    v_texcoord = a_texcoord;
}