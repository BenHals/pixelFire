var W = window.innerWidth, H = window.innerHeight;
var pixel_size = 20;
var update_time = 1;
var update_amount = 5;
var bsf_update_amount = 50;
var pixel_fade_in = 2000;
var p_row_size = W/pixel_size;
var p_col_size = H/pixel_size;

class Pixel {
	constructor(size, x, y, ctx){
		this.size = size;
		this.x = x;
		this.y = y;
		this.pixel_x = x*size;
		this.pixel_y = y*size;
		this.nearest = [];
		this.hue = 180;
		this.saturation = 100;
		this.lightness = 100;
		this.ctx = ctx;
		this.is_on = false;

		// color animation vars
		this.hue_target = 180;
		this.hue_time_remaining = 0;

		this.lightness_target = 100;
		this.lightness_time_remaining = 0;

		// Want later animations to overide earlier (for now)
		this.ani_timestamp = 0;

		// Vars for distance checking
		this.current_closest_node = null;
		this.current_closest_distance = 10000000;
		this.owner_color = [180,100,100];
		this.is_node = false;
	}
	get colorHSL() {
		return 'hsl(' + this.hue + ',' + this.saturation + '%,' + this.lightness +'%)';
	}
	draw() {
		this.ctx.fillStyle = this.colorHSL;
		this.ctx.fillRect(this.pixel_x, this.pixel_y, this.size, this.size);
	}
	check_timestamp(ts){
		return ts > this.ani_timestamp;
	}
	change_color(change_to, ts){
		this.hue_target = change_to;
		this.hue_time_remaining = pixel_fade_in;
		this.ani_timestamp = ts;
	}

	change_lightness(change_to, ts){
		this.lightness_target = change_to;
		this.lightness_time_remaining = pixel_fade_in;
		this.ani_timestamp = ts;
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
// Make pixel grid
var pixels = [];
var pixel_draw_stack = [[[1,0],[2,0],[3,0],[4,0],[5,0]]];
var BFS_threads = [];
var start_time = new Date();
var last_timestamp;
var last_update_time = start_time;
var canvas;
var ctx;
var box_toggle = 0;


// These will be the nodes, grouped by category
var nodes = [];

// Set up node categories
var node_categories = ['c1', 'c2'];
// cool colors
var node_category_colors = [[71,100,96],[301,100,6]];
//var node_category_colors = [[Math.random()*360,100,Math.random()*50 + 50],[Math.random()*360,100,Math.random()*50]]
for(var c = 0; c < node_categories.length; c++){
	nodes.push([]);
}

function turn_on_random(chance_per_frame, index_time){
	var index = index_time[0];
	var timestamp = index_time[1];
	if(index == -1) return
	var turn_on = Math.random();
	if(turn_on <= chance_per_frame){
		var random_pixel_index = index != undefined ? index : Math.round(Math.random() * (p_row_size*p_col_size));
		var random_color = Math.floor(Math.random()*360)
		if(pixels[random_pixel_index].check_timestamp(timestamp)){
			pixels[random_pixel_index].turn_on();
			pixels[random_pixel_index].change_color(random_color, timestamp);
		}
	}
}

function turn_on_category(index_time){
	var index = index_time[0];
	var timestamp = index_time[1];

	if(index == -1) return

	//if(pixels[index].check_timestamp(timestamp)){
		pixels[index].turn_on();
		var color = pixels[index].owner_color;
		pixels[index].change_color(color[0], timestamp);
		pixels[index].change_lightness(color[2], timestamp);
	//}
	
}
function update_screen(timestamp){
	for(var i =0; i < bsf_update_amount; i++){
		BFS_manager();
	}
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

	// Do major update if time
	if(new_update){
		for(var u = 0;u < update_amount; u++){
			// logic to turn on or off pixels
			// take off top element of all pixel_draw_stacks
			var empty_stacks = [];
			for(var stack = 0; stack < pixel_draw_stack.length; stack++){
				stack_size = pixel_draw_stack[stack].length;
				if(stack_size > 0){
					var first_in_stack = pixel_draw_stack[stack].shift();
					var index = first_in_stack != undefined ? first_in_stack : -1;
					turn_on_category(index);
				}else{
					empty_stacks.push(stack);
				}
			}

			for(var es = 0; es < empty_stacks.length; es++){
				//pixel_draw_stack.splice(es,1);
			}
		}
	}


	ctx.clearRect(0, 0, W, H);

	// Draw pixels
	for(var p = 0; p < pixels.length; p++){
		pixels[p].hue_animate(timestamp_diff);
		pixels[p].lightness_animate(timestamp_diff);
		pixels[p].draw();
	}

	window.requestAnimationFrame(update_screen);
}
function get_distance(A,B){
	return Math.sqrt(Math.pow(A[0] - B[0],2)+Math.pow(A[1] - B[1], 2));
}

function BFS_manager(){
	var counter = 0;
		counter++;
		for(var i =0; i < BFS_threads.length; i++){
			var bfs_runner = BFS_threads[i];

			var queue = bfs_runner['queue'];
			if(queue.length <= 0) continue;
			
			var options = bfs_runner['options'];
			var start_index = options[0];
			var node_category = options[1];
			var stack_index = options[2];
			var timestamp = options[3];
			
			var checked = bfs_runner['checked'];
			var start_position = bfs_runner['start_position'];
			var current_pixel;
            if(box_toggle == 0){
                current_pixel = queue.shift();
            }else{
                current_pixel = queue.pop();
            }
			var current_pixel_obj = pixels[current_pixel];
			if(current_pixel_obj == undefined){
				alert('why');
			}
			var current_pixel_position = [current_pixel_obj.x + pixel_size/2, current_pixel_obj.y + pixel_size/2];

			var distance_to_start = get_distance(start_position, current_pixel_position);
			if(current_pixel_obj.current_closest_distance > distance_to_start){

				// Since the starting node is the closest to the pixel, set it as new closest
				current_pixel_obj.current_closest_node = start_index;
				current_pixel_obj.current_closest_distance = distance_to_start;

				var add = [];
				var above = current_pixel - Math.ceil(p_row_size);
				if(above >= 0 && checked.indexOf(above) == -1 && queue.indexOf(above) == -1) add.push(above);
				var left = current_pixel - 1;
				if(left >= 0 && checked.indexOf(left) == -1 && queue.indexOf(left) == -1 && current_pixel_obj.x > 0) add.push(left);
				var right = current_pixel + 1;
				if(right < pixels.length && checked.indexOf(right) == -1 && queue.indexOf(right) == -1 && current_pixel_obj.x < Math.floor(p_row_size)) add.push(right);
				var below = current_pixel + Math.ceil(p_row_size);
				if(below < pixels.length && checked.indexOf(below) == -1 && queue.indexOf(below) == -1) add.push(below);

				if(box_toggle == 2) shuffle(add);
				for(var a = 0; a < add.length; a++){
					queue.push(add[a]);
				}
				// Draw all except the starting pixel, which is colored as a node
				if(current_pixel != start_index){
					current_pixel_obj.owner_color = node_category_colors[node_categories.indexOf(node_category)];
					pixel_draw_stack[stack_index].push([current_pixel,timestamp]);
				}else{
					current_pixel_obj.current_closest_node = start_index;
					current_pixel_obj.current_closest_distance = 0;
					current_pixel_obj.is_node = true;
					current_pixel_obj.owner_color = [180, 100, 100*node_categories.indexOf(node_category)];
					pixel_draw_stack[stack_index].push([current_pixel,timestamp]);
				}
			}
			checked.push(current_pixel);

		}
}
function shuffle(a) {
    for (let i = a.length; i; i--) {
        let j = Math.floor(Math.random() * i);
        [a[i - 1], a[j]] = [a[j], a[i - 1]];
    }
}
function start_bfs(start_index, node_category, stack_index, timestamp){
	var bfs_runner = {};
	bfs_runner['options'] = [start_index, node_category, stack_index, timestamp];
	bfs_runner['queue'] = [start_index];
	bfs_runner['checked'] = [];
	bfs_runner['start_position'] = [pixels[start_index].x + pixel_size/2, pixels[start_index].y + pixel_size/2];

	BFS_threads.push(bfs_runner);
}
function BFS(start_index, node_category, stack_index, timestamp){
	var queue = [start_index];
	var checked = [];
	var start_position = [pixels[start_index].x + pixel_size/2, pixels[start_index].y + pixel_size/2];
	while(queue.length > 0 && checked.length < 100000000){
		//var current_pixel = queue.shift();
        var current_pixel = queue.pop();
		var current_pixel_obj = pixels[current_pixel];
		var current_pixel_position = [current_pixel_obj.x + pixel_size/2, current_pixel_obj.y + pixel_size/2];

		var distance_to_start = get_distance(start_position, current_pixel_position);
		if(current_pixel_obj.current_closest_distance > distance_to_start){

			// Since the starting node is the closest to the pixel, set it as new closest
			current_pixel_obj.current_closest_node = start_index;
			current_pixel_obj.current_closest_distance = distance_to_start;

			var above = current_pixel - Math.ceil(p_row_size);
			if(above >= 0 && checked.indexOf(above) == -1 && queue.indexOf(above) == -1) queue.push(above);
			var left = current_pixel - 1;
			if(left >= 0 && checked.indexOf(left) == -1 && queue.indexOf(left) == -1 && current_pixel_obj.x > 0) queue.push(left);
			var right = current_pixel + 1;
			if(right < pixels.length && checked.indexOf(right) == -1 && queue.indexOf(right) == -1 && current_pixel_obj.x < Math.floor(p_row_size)) queue.push(right);
			var below = current_pixel + Math.ceil(p_row_size);
			if(below < pixels.length && checked.indexOf(below) == -1 && queue.indexOf(below) == -1) queue.push(below);

			// Draw all except the starting pixel, which is colored as a node
			if(current_pixel != start_index){
				current_pixel_obj.owner_color = node_category_colors[node_categories.indexOf(node_category)];
				pixel_draw_stack[stack_index].push([current_pixel,timestamp]);
			}else{
				current_pixel_obj.current_closest_node = start_index;
				current_pixel_obj.current_closest_distance = 0;
				current_pixel_obj.is_node = true;
				current_pixel_obj.owner_color = [180, 100, 100*node_categories.indexOf(node_category)];
				pixel_draw_stack[stack_index].push([current_pixel,timestamp]);
			}
		}
		checked.push(current_pixel);

	}


}
window.onload = function(){

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
		var time = new Date();	
		if(event.button ===0){
			add_node('c1', mouseX, mouseY, time);
		}
		if(event.button === 1){
			box_toggle++;
            box_toggle %= 3;
		} 
		if(event.button === 2){
			add_node('c2', mouseX, mouseY, time);
		} 
		

	},false);
   document.onkeypress = function(e){
        e =e || window.event;
        if(e.keyCode == 32){
            box_toggle++;
            box_toggle %= 3;
        }
    }
	for(var y = 0; y < p_col_size; y++){
		for(var x = 0; x < p_row_size; x++){
			pixels.push(new Pixel(pixel_size, x, y, ctx))
		}
	}
	BFS_manager();
	window.requestAnimationFrame(update_screen);
}

function add_node(node_category, mouseX, mouseY, time){
		var pixel_x = Math.floor(mouseX/pixel_size);
		var pixel_y = Math.floor(mouseY/pixel_size);

		var pixel_index = (pixel_y * Math.ceil(p_row_size)) + pixel_x;
		var stack_index = pixel_draw_stack.length;
		pixel_draw_stack.push([]);
		start_bfs(pixel_index, node_category, stack_index, time- start_time);
		//pixel_draw_stack.push(pixel_index);
		// var random_color = Math.floor(Math.random()*360)

		// pixels[pixel_index].turn_on();
		// pixels[pixel_index].change_color(random_color);
}