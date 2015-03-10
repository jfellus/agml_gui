
String.prototype.replaceAll = function (find, replace) {
    var str = this;
    return str.replace(new RegExp(find, 'g'), replace);
};	

if (typeof String.prototype.startsWith != 'function') {
	  String.prototype.startsWith = function (str){
	    return this.slice(0, str.length) == str;
	  };
	}


function DBG(x) {
	$("body").prepend("<div>"+x+"</div>");
}

function file_read(f, callback) {
	return exec_async("cat " + f, callback);
}

function file_write(f, str) {
	return exec_async("echo '"+ str + "' > " + f);
}

function file_read_array(f, callback) {
	return file_read(f, function(err,stdout,stderr){callback(stdout.split("\n"));});
}

function file_write_array(f, a) {
	file_write(f, a.join("\n"));
}

function clear() {
	$("#content").empty();
}


function list_append_array(list, a) {
	var ul = list.children("ul");
	for(var i = 0; i<a.length; i++) {
		if(a[i].trim().length) ul.append("<li>"+a[i]+"</li>");
	}
}


function touch(f) {
	fs.closeSync(fs.openSync(f, 'a'));
}

function file_change_ext(f, ext) {
	return f.substr(0, f.lastIndexOf(".")) + ext;
}

function get_list_data(list) {
	var a = [];
	var ul = $(list).children("ul");
	ul.children().each(function() { a.push($(this).text());});
	return a;
}

function link_list_to_file(list, file, callback) {
	var l = $(list);
	
	function update() {
		var a = [];
		$(list).children("ul").children().each(function() {a.push($(this).text())});
		file_write_array(file, a);	
		callback();
	}
	
	exec_async("mkdir -p ~/.agml/; touch " + file, function() {
		file_read_array(file, function(a) {
			var ul = $(list).children("ul")
			ul.empty();
			for(var i = 0; i<a.length; i++) {
				if(a[i].trim().length) ul.append("<li>"+a[i]+"</li>");
			}
			callback();
		});
	});
	

	var _d = null;
	l.keyup(function() {
		if(_d) clearTimeout(_d);
		_d = setTimeout(update, 1000);
	});
}

function list_dir(dir, callback) {
	exec_async("find "+dir+" -maxdepth 1 -type f", function(error, stdout, stderr){
		callback(stdout.split("\n"));
	});
}

function list_dir_filter(dir, filter, callback) {
	exec_async("find "+dir+" -name '"+filter+"' -maxdepth 1 -type f", function(error, stdout, stderr){
		callback(stdout.split("\n"));
	});
}

$(function() {
	$(".list > div:first-child").click(function() {
		$(this).parent().children(".content").slideToggle();
	});
});






//////////////////////


function ssh_host_decode(str) {
	var ssh_host= {
			enc:str.slice("ssh://".length).replaceAll("/", "_"),
			host:str.slice("ssh://".length), 
			path:"~"
		};
	var z = ssh_host.host.indexOf("/")+1;
	if(z) {
		ssh_host.path = ssh_host.host.slice(z);
		ssh_host.host = ssh_host.host.slice(0,z-1);
	}
	return ssh_host;
}


function sshfs_connect(sshfs, callback) {
	if(sshfs.connected) callback();
	else {
		var cmd = "/bin/bash -c 'mkdir -p "+sshfs.mount_point+"; chmod a+wxr "+sshfs.mount_point+"; sshfs -o IdentityFile=~/.ssh/id_rsa -o StrictHostKeyChecking=no "+sshfs.host+":"+sshfs.path+" "+sshfs.mount_point + "'";
		exec_async(cmd, function(error, stdout, stderr){
			sshfs.connected = true;
			callback();
		});
	}
}

function sshfs_disconnect(sshfs, callback) {
	if(!sshfs.connected) callback();
	else {
		exec_async("fusermount -u " + sshfs.mount_point, function() {
			sshfs.connected = false;
			callback();
		});
	}
}


//////////////////


function create_table(data) {
	var t = $("<table></table>");
	for(var i = 0; i<data.length; i++) {
		var tr = $("<tr></tr>");
		t.append(tr);
		for(var j = 0; j<data[i].length; j++) {
			tr.append("<td>"+data[i][j]+"</td>");
		}
	}
	return t;
}




////////////////

CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
	  if (w < 2 * r) r = w / 2;
	  if (h < 2 * r) r = h / 2;
	  this.beginPath();
	  this.moveTo(x+r, y);
	  this.arcTo(x+w, y,   x+w, y+h, r);
	  this.arcTo(x+w, y+h, x,   y+h, r);
	  this.arcTo(x,   y+h, x,   y,   r);
	  this.arcTo(x,   y,   x+w, y,   r);
	  this.closePath();
	  return this;
}

function plot(elt, data, color, fmt_fn) {
	var c = $(elt).get(0);
	var ctx = c.getContext("2d");
	
	var min = 0;
	var max = 50000;
	
	function x(_x) {return _x*c.width/(data.length-1);}
	function y(_y) {return c.height*(1 + (min-_y)/(max-min));}

	if(color) ctx.fillStyle=color;
	ctx.beginPath();
	ctx.moveTo(x(0), y(0));
	for(var i = 0; i<data.length; i++) {
		ctx.lineTo(x(i),y(data[i]));
	}
	ctx.lineTo(x(data.length-1), y(0));
	ctx.closePath();
	ctx.fill();
	
	var txt = fmt_fn ? fmt_fn(data[data.length-1]) : data[data.length-1];
	ctx.font="bold 10px Arial";
	var w = ctx.measureText(txt).width;
	var h = ctx.measureText('M').width/2;
	ctx.fillStyle="white";
	ctx.roundRect(c.width/2-w/2-7,c.height-h*2 - 10, w+16,h+6, 15).fill();
	ctx.fillStyle=color;
	ctx.fillText(txt,c.width/2-w/2,c.height-10);
	
}