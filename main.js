
var W = window.innerWidth, H = window.innerHeight;
var pixel_size = 7;
var update_time = 50;
var pixel_fade_in = update_time - 5;
var p_row_size = W/pixel_size;
var p_col_size = H/pixel_size;
// Make pixel grid
var pixels = [];
var pixel_draw_stack = [];
var start_time = new Date();
var last_timestamp;
var last_update_time = start_time;
var canvas;
var ctx;
let fire_color = ['#000000','#290e01','#471204','#671206','#871106','#a90d05','#cc0603','#ed0101','#ff3d01','#ff6f19','#ff9237','#ffb15b','#ffcc83','#ffe6b0','#ffffe0'];
let min_temp = 0;
let max_temp = 1200;
let min_y_reached = 0;
let min_row_reached = 0;
let wind = -1;
let init_temp = 1500;
let temp_dec = 50;
let req_ani_frame_id = 0;


function init_grid(){
	p_row_size = W/pixel_size;
	p_col_size = H/pixel_size;
	// Make pixel grid
	pixels = [];
	pixel_draw_stack = [];
	start_time = new Date();
	last_timestamp;
	last_update_time = start_time;
}
class Pixel {
	constructor(size, x, y, ctx){
		this.size = size;
		this.x = x;
		this.y = y;
		this.pixel_x = x*size;
		this.pixel_y = y*size;
		this.nearest = [];
		this.hue = 180;
		this.saturation = 50;
		this.lightness = 100;
		this.ctx = ctx;
		this.is_on = false;

		// color animation vars
		this.hue_target = 180;
		this.hue_time_remaining = 0;

		this.lightness_target = 100;
		this.lightness_time_remaining = 0;

		this.temperature = 0;
		this.temperature_time_remaining = 0;
		this.temperature_target = 0;
	}
	get colorHSL() {
		return 'hsl(' + this.hue + ',' + this.saturation + '%,' + this.lightness +'%)';
	}
	draw() {
		this.ctx.fillStyle = this.temp_to_hue;
		this.ctx.fillRect(this.pixel_x, this.pixel_y, this.size, this.size);
	}

	change_temperature(change_to){
		this.temperature_target = change_to;
		this.temperature_time_remaining = pixel_fade_in;

	}
	change_color(change_to){
		this.hue_target = change_to;
		this.hue_time_remaining = pixel_fade_in;
	}

	change_lightness(change_to){
		this.lightness_target = change_to;
		this.lightness_time_remaining = pixel_fade_in;
	}

	hue_animate(time_delta){
		if(this.hue_time_remaining <= 0) return;

		// Find proportion of time that has passed
		var animation_proportion = 0;
		if(time_delta < this.hue_time_remaining){
			animation_proportion = time_delta/this.hue_time_remaining;
			this.hue_time_remaining -= time_delta;
		}else{
			animation_proportion = 1;
			this.hue_time_remaining = 0;
		}

		// amount of hue change needed total
		var hue_delta = this.hue_target - this.hue;

		// To find the actual hue delta, we need to check if going around the color space is shorter
		if(this.hue_target < this.hue){
			var flipped_hue_target = this.hue_target + 360;
			hue_delta = Math.abs(this.hue_target - this.hue) < Math.abs(flipped_hue_target - this.hue) ? this.hue_target - this.hue : flipped_hue_target - this.hue;
		}else{
			var flipped_hue = this.hue + 360;
			hue_delta = Math.abs(this.hue_target - this.hue) < Math.abs(this.hue_target - flipped_hue) ? this.hue_target - this.hue : this.hue_target - flipped_hue;
		}

		// amount of hue to change this update
		var update_hue_delta = hue_delta*animation_proportion;

		this.hue += update_hue_delta

	}

	get temp_to_hue(){
		// Clamp temp
		let temp = Math.max(Math.min(this.temperature, max_temp), min_temp);
		if(temp == max_temp) return d3.color(fire_color[fire_color.length - 1]);
		let temp_proportion = (temp - min_temp) / (max_temp - min_temp);
		let temp_step = Math.floor(temp_proportion * (fire_color.length - 1));
		let upper_step = Math.ceil(temp_proportion * (fire_color.length - 1));
		let step_proportion = (temp_proportion * (fire_color.length - 1)) - temp_step;
		return d3.interpolateRgb(fire_color[temp_step], fire_color[upper_step])(step_proportion);
	}

	temperature_animate(time_delta){
		if(this.temperature_time_remaining <= 0) return;

		// Find proportion of time that has passed
		var animation_proportion = 0;
		if(time_delta < this.temperature_time_remaining){
			animation_proportion = time_delta/this.temperature_time_remaining;
			this.temperature_time_remaining -= time_delta;
		}else{
			animation_proportion = 1;
			this.temperature_time_remaining = 0;
		}

		// amount of temperature change needed total
		var temperature_delta = this.temperature_target - this.temperature;

		// amount of temperature to change this update
		var update_temperature_delta = temperature_delta * animation_proportion;

		this.temperature += update_temperature_delta;
		
	}

	lightness_animate(time_delta){
		if(this.lightness_time_remaining <= 0) return;

		// Find proportion of time that has passed
		var animation_proportion = 0;
		if(time_delta < this.lightness_time_remaining){
			animation_proportion = time_delta/this.lightness_time_remaining;
			this.lightness_time_remaining -= time_delta;
		}else{
			animation_proportion = 1;
			this.lightness_time_remaining = 0;
		}

		// amount of hue change needed total
		var lightness_delta = this.lightness_target - this.lightness;

		// amount of hue to change this update
		var update_lightness_delta = lightness_delta*animation_proportion;

		this.lightness += update_lightness_delta
	}

	turn_on(){
		this.is_on = true;
		this.change_lightness(50);
	}

	turn_off(){
		this.is_on = false;
		this.change_lightness(100);
	}
}


function turn_on_random(chance_per_frame){
	var turn_on = Math.random();
	if(turn_on <= chance_per_frame){
		var random_pixel_index = Math.round(Math.random() * (p_row_size*p_col_size));
		var random_color = Math.floor(Math.random()*2000)

		pixels[random_pixel_index].temperature = 1500;
		pixels[random_pixel_index].turn_on();
		pixels[random_pixel_index].change_temperature(0);
	}
}
function turn_on_random_floor(chance_per_frame){
	for(let x = 0; x < 10; x++){
		var turn_on = Math.random();
		if(turn_on <= chance_per_frame){
			var random_pixel_index = pixels.length - Math.floor(Math.random() * p_row_size) -1;
			var random_color = Math.floor(Math.random()*2000)
	
			pixels[random_pixel_index].temperature = init_temp + Math.random() * 10000;
			pixels[random_pixel_index].turn_on();
			pixels[random_pixel_index].change_temperature(init_temp);
		}
	}
}

function update_temperatures(){
	min_y_reached = H;
	let last_min_row_reached = min_row_reached;
	min_row_reached = Math.floor(p_col_size);
	for(var y = Math.max(0, last_min_row_reached - 2); y < p_col_size; y++){
		for(var x = 0; x < p_row_size; x++){
			let p_index = (y * Math.ceil(p_row_size)) + x;
			let current_temp = pixels[p_index].temperature;

			let under_row = y + 1;
			if(under_row > p_col_size){
				pixels[p_index].temperature = init_temp;
				pixels[p_index].turn_on();
				pixels[p_index].change_temperature(init_temp - 50);
				continue;
			};
			let under_index = Math.max(Math.min((under_row * Math.ceil(p_row_size)) + Math.min((x + wind), Math.floor(p_row_size)), Math.floor(pixels.length - 1)), 0);
			if(pixels[under_index] == undefined){
				console.log("test");
			}
			let under_temp = pixels[under_index].temperature_target;

			let new_temperature = under_temp - (0.1 + (Math.random() * temp_dec));
			if(Math.max(new_temperature, 0) != Math.max(current_temp, 0)){
				pixels[p_index].turn_on();
				pixels[p_index].change_temperature(new_temperature);
				min_y_reached = Math.min(min_y_reached, pixels[p_index].y);
				min_row_reached = Math.min(min_row_reached, y);
			}

		}
	}
}

function update_screen(timestamp){
	if(!last_timestamp) last_timestamp = timestamp;
	var timestamp_diff = timestamp-last_timestamp;
	last_timestamp = timestamp;

	var current_time = new Date();
	var time_since_update = current_time - last_update_time;
	var new_update = false;

	// We want to do a major update, I.E turn a new pixel on or off, every x seconds (set by update_time)
	// between these update will be minor animations like pixel colors changing.
	if(time_since_update > update_time){
		new_update = true;
		last_update_time = current_time;
	}




	ctx.clearRect(0, min_y_reached, W, H);
	ctx.fillStyle = "black";
	ctx.fillRect(0, min_y_reached, W, H);

	// Draw pixels
	for(var y = Math.floor(Math.max(0, min_row_reached - 2)); y < p_col_size; y++){
		for(var x = 0; x < p_row_size; x++){
			let p = (y * Math.ceil(p_row_size)) + x;
			pixels[p].temperature_animate(timestamp_diff);
			pixels[p].lightness_animate(timestamp_diff);
			pixels[p].draw();
		}
	}

	// Do major update if time
	if(new_update){
		// logic to turn on or off pixels
		update_temperatures();
	}
	//turn_on_random_floor(1);
	

	req_ani_frame_id = window.requestAnimationFrame(update_screen);
}

window.onload = function(){

	init_grid();
	cancelAnimationFrame(req_ani_frame_id);
	// Setup Canvas
	canvas = document.getElementById("canvas");
	ctx = canvas.getContext("2d");

	canvas.width = W;
	canvas.height = H;
	
	//Painting the canvas black
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, W, H);


	// Canvas Click event listener
	canvas.addEventListener("mousedown",function(event){

		var mouseX = event.pageX;
		var mouseY = event.pageY;

		if(event.button ===0){
			var pixel_x = Math.floor(mouseX/pixel_size);
			var pixel_y = Math.floor(mouseY/pixel_size);

			var pixel_index = (pixel_y * Math.ceil(p_row_size)) + pixel_x;

			pixels[pixel_index].temperature = 2000;
			pixels[pixel_index].turn_on();
			pixels[pixel_index].change_temperature(1200);
		}
		

	},false);

	document.onkeypress = function(e){
        e = e || window.event;
		let key_pressed = e.keyCode;
		console.log(key_pressed);
		if(key_pressed == 100){
			wind -= 1;
		}
		if(key_pressed == 97){
			wind += 1;
		}
		if(key_pressed == 115){
			init_temp -= 100;
		}
		if(key_pressed == 119){
			init_temp += 100;
		}
		if(key_pressed == 114){
			temp_dec -= 2;
		}
		if(key_pressed == 102){
			temp_dec += 2;
		}
		if(key_pressed == 122){
			update_time -= 2;
		}
		if(key_pressed == 120){
			update_time += 2;
		}
		if(key_pressed == 99){
			pixel_fade_in -= 2;
		}
		if(key_pressed == 118){
			pixel_fade_in += 2;
		}
		if(key_pressed == 101){
			pixel_size -= 1;
			pixel_size = Math.max(pixel_size, 1);
			window.onload();
		}
		if(key_pressed == 113){
			pixel_size += 1;
			window.onload();
		}
    }
	for(var y = 0; y < p_col_size; y++){
		for(var x = 0; x < p_row_size; x++){
			pixels.push(new Pixel(pixel_size, x, y, ctx))
		}
	}
	turn_on_random(1);

	window.requestAnimationFrame(update_screen);
}