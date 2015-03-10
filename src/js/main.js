var ngui = require('nw.gui');
var nwin = ngui.Window.get();
var sys = require('sys');
var exec_async = require('child_process').exec;
var fs = require('fs');
var path = require('path');


var ROOT_HOST = null;

/////////////////////////////////

function fmt_ko(x) {
	if(x >= 1000) {
		x /= 1000.0;
		if(x >= 1000) {
			x /= 1000.0;
			return Math.round(x*10)/10 + "Go/s";
		}
		return Math.round(x*10)/10 + "Mo/s";
	}
	return Math.round(x*10)/10 + "Ko/s";
}

/////////////////////////////////

var NB_INFOS = 0;
var NODEGROUP_DATA = {};


function fvec_dump(e) {
	var what = "save";
	var node_id = e.children(".id").html();
	var cmd = "agml " + ROOT_HOST + " node_request \"" + node_id + " " + what + "\"";
	exec_async(cmd, function(error, stdout, stderr){
		var f = stderr;
		if(f.startsWith("ERROR")) alert(f);
		else if(f.startsWith("done")) {}
		else 	exec_async("fvec_dump -f html " + f, function(error, stdout, stderr) {
			add_widget(node_id + " " + what, stderr+stdout);
		});
	});
}

function fvec_dump_dims(e) {
	var what = "save";
	var node_id = e.children(".id").html();
	var cmd = "agml " + ROOT_HOST + " node_request \"" + node_id + " " + what + "\"";
	exec_async(cmd, function(error, stdout, stderr){
		var f = stderr;
		if(f.startsWith("ERROR")) alert(f);
		else if(f.startsWith("done")) {}
		else 	exec_async("fvec_dump -f dims " + f, function(error, stdout, stderr) {
			add_widget(node_id + " " + what, stderr+stdout);
		});
	});
}


////////////////
// EVALUATORS //
////////////////

var EVALUATORS = {
		NodeKMeans: {cmd:"eval_kmeans", params:["X","$"] },
		NodePCA: {cmd:"eval_pca", params:["X", "$"] },
		NodeSVM: {cmd:"eval_svm", params:["X", "y", "$"] }
}

var EVAL_DATA = {
		X: "none"
}

function get_evaluator(cls) {
	var eval_cmd = null;
	for(var i in EVALUATORS) {
		if(cls==i) eval_cmd = EVALUATORS[i];
	}
	return eval_cmd;
}

function eval_node(e) {
	var cls = e.children(".cls").html();
	var node_id = e.children(".id").html();

	var eval_cmd = get_evaluator(cls);
	if(!eval_cmd) {alert("No evaluator defined for NodeClass " + cls);}
	
	var what = "save";
	var cmd = "agml " + ROOT_HOST + " node_request \"" + node_id + " " + what + "\"";
	exec_async(cmd, function(error, stdout, stderr){
		var f = stderr;
		if(f.startsWith("ERROR")) alert(f);
		else if(f.startsWith("done")) {}
		else {
			var cmd = eval_cmd.cmd;
			for(var i=0; i<eval_cmd.params.length; i++) {
				cmd += " ";
				if(eval_cmd.params[i]=="$") cmd += f;
				else cmd += EVAL_DATA[eval_cmd.params[i]];
			}
			exec_async(cmd, function(error, stdout, stderr) {
				var widget = "Eval " + node_id;
				var w = get_widget(widget);
				if(w==null) { add_widget(widget, ""); w = get_widget(widget); }
				w.append(stderr+"<br>");
				exec_async("echo \""+stdout+"\" >> /run/shm/agml/eval_" + node_id + ".txt");
			});
		}
	});
}

var MONITOR_INTERVALS=[];
function monitor_node_start(e) {
	var node_id = e.children(".id").html();
	plot_reset(node_id);
	MONITOR_INTERVALS[node_id] = true;
	setTimeout(function() {monitor_node(e);}, 1000);
}

function monitor_node_stop(e) {
	var node_id = e.children(".id").html();
	MONITOR_INTERVALS[node_id] = undefined;
}

function monitor_node(e) {
	var cls = e.children(".cls").html();
	var node_id = e.children(".id").html();

	var eval_cmd = get_evaluator(cls);
	if(!eval_cmd) {alert("No evaluator defined for NodeClass " + cls);}
	
	var what = "save";
	var cmd = "agml " + ROOT_HOST + " node_request \"" + node_id + " " + what + "\"";
	exec_async(cmd, function(error, stdout, stderr){
		var f = stderr;
		if(f.startsWith("ERROR")) alert(f);
		else if(f.startsWith("done")) {}
		else {
			var cmd = eval_cmd.cmd;
			for(var i=0; i<eval_cmd.params.length; i++) {
				cmd += " ";
				if(eval_cmd.params[i]=="$") cmd += f;
				else cmd += EVAL_DATA[eval_cmd.params[i]];
			}
			exec_async(cmd, function(error, stdout, stderr) {
				var widget = "Plot " + node_id;
				var w = get_widget(widget);
				if(w==null) { add_widget(widget, ""); w = get_widget(widget); }
				
				plot_add(node_id, stdout.trim(), function() {
					if(MONITOR_INTERVALS[node_id]) setTimeout(function() {monitor_node(e, true);}, 200);
				});
			});
		}
	});
}


//////////
// PLOT //
//////////

function plot_add(node_id, x, on_done) {
	if(x.trim().length==0) return;
	
	var f = "/run/shm/agml/plot_"+node_id+".txt";
	exec_async("mkdir -p /run/shm/agml; echo \"" + x + "\" >> " + f, function(error, stdout,stderr) {
		var params = {
				title:node_id,
				xlabel:"x", ylabel:"y"
		};
		create_plot_py(f, params, function() {
			exec_async("/run/shm/agml/plot_"+node_id+".py", function(error, stdout, stderr) {
				var w = get_widget("Plot " + node_id);
				if(w.find("img.plot").length==0) {
					w.html("<h3>Plot "+node_id+"</h3>" +
							"<img class='plot' height=300px src='file:///run/shm/agml/plot_"+node_id+".svg'></img>" +
							"<button class='stop'>Stop</button><button class='x'>x</button>");
					w.find("button.stop").click(function() { MONITOR_INTERVALS[node_id] = undefined; });
					w.find("button.x").click(function() { MONITOR_INTERVALS[node_id] = undefined; w.remove(); });
				}
				w.find("img.plot").attr("src", "file:///run/shm/agml/plot_"+node_id+".svg?timestamp=" + new Date().getTime());
				
				on_done();
			});
		});
	});
}

function plot_reset(node_id) {
	var f = "/run/shm/agml/plot_"+node_id+".txt";
	exec_async("rm -f " + f + "; touch " + f, function(error, stdout,stderr) {});
}

var TOOLS_DIR = "/home/jfellus/agml/";
function create_plot_py(f, params, on_done) {
	params["file_input"] = f;
	params["file_output"] = file_change_ext(f,".svg");
	var pyf = file_change_ext(f, ".py");
	var out = "#!/usr/bin/python\n";
	out += "import sys\nimport os\nfrom numpy import *\nimport matplotlib.pyplot as plt\nimport matplotlib.cm as cm\nimport matplotlib\n\n";
	for(var i in params) out += i + "=\\\"" + params[i] + "\\\"\n";
	out += "\n\n";
	
	exec_async('echo "' + out + '" > ' + pyf + "; cat " + TOOLS_DIR + "/plot_template.py >> " + pyf + "; chmod a+x " + pyf, function(error,stdout,stderr) {on_done();});
}

///////////

function update_top() {
	$("#top").html(NB_INFOS + "infos");
}

function get_info_elt(p) {
	var info = null;
	var all = $("#content_table").find(".path:contains('"+p+"')");
	if(all.length==0) {
		info = $("<tr class='info'><td class='path'>"+p+"</td></tr>");
		if(($("#content_table tr").length%2)==0) info.addClass("even");
		$("#content_table").append(info);
	}
	else info = all.eq(0).parent();
	return info;
}

function update_agml_info_node(group_name, host_name, cls, id, node) {
	var ELTID = group_name + "_" + host_name + "_" + id;
	var e = get_info_elt(ELTID);
	e.removeClass("should_disappear");
	e.addClass("node");
	
	if(node.bAttached=="0") e.addClass("detached");
	else e.removeClass("detached");
	
	e.html( "<td class='path'>"+ELTID+"</td>" +
			"<td class='type_node'></td>" +
			"<td class='id'>" + group_name + "@" + host_name  + "[" + id + "]</td>" +
			"<td>" + id + "</td>" +
			"<td class='cls'>" + cls + "</td>" +
			"<td>" + node.nbProcess + "</td>" +			
			"<td>" + node.nbSend + "</td>" +			
			"<td>" + node.nbRecv + "</td>" +			
			"<td>" + node.ips + "</td>" +			
			"<td>" + fmt_ko(node.Ko_s) + "</td>" +			
			"<td>" + fmt_ko(node.Ko_r) + "</td>" +			
			"<td>" + node.moy + "</td>" +			
			"<td>" + node.var + "</td>" +
			"<td class='actions'></td>"
	);
	
	var btn_dump = $("<button>Dump</button>").click(function(){ fvec_dump($(this).parent().parent());});
	var btn_dims = $("<button>Dims</button>").click(function(){ fvec_dump_dims($(this).parent().parent());});
	var btn_eval = $("<button>Eval</button>").click(function(){ eval_node($(this).parent().parent());});
	var btn_monitor = $("<button>Monitor</button>").click(function(){ monitor_node_start($(this).parent().parent());});
	e.children(".actions").append(btn_dump);
	e.children(".actions").append(btn_dims);
	e.children(".actions").append(btn_eval);
	e.children(".actions").append(btn_monitor);
} 

function update_agml_info_node_group_host(group_name, ngh, cls) {
	var host_name = ngh.name;
	var nb_nodes = parseInt(ngh.nb_nodes);
	var info = ngh.infos;
	var ELTID = group_name + "_" + host_name;
	var e = get_info_elt(ELTID);
	e.removeClass("should_disappear");
	e.addClass("group_host");
	e.html( "<td class='path'>"+ELTID+"</td>" +
			"<td class='type_group_host'></td>" +
			"<td>" + group_name + "@" + host_name  + "</td>" +
			"<td>" + ngh.nb_nodes + "</td>" +
			"<td>" + cls + "</td>" +
			"<td>" + info.nbProcess + "</td>" +			
			"<td>" + info.nbSend + "</td>" +			
			"<td>" + info.nbRecv + "</td>" +			
			"<td>" + "<center><canvas class='plot_ips' width='100px' height='30px'></canvas></center></td>" +			
			"<td>" + "<center><canvas class='plot_kos' width='100px' height='30px'></canvas></center></td>" +			
			"<td>" + "<center><canvas class='plot_kor' width='100px' height='30px'></canvas></center></td>" +			
			"<td>" + info.moy + "</td>" +			
			"<td>" + info.var + "</td>" +
			"<td></td>"
	);
	
	alldata = NODEGROUP_DATA[ELTID];
	if(!alldata) alldata = NODEGROUP_DATA[ELTID] = {};
	if(!alldata.ips) alldata.ips = [];
	if(!alldata.Ko_s) alldata.Ko_s = [];
	if(!alldata.Ko_r) alldata.Ko_r = [];
	alldata.ips.push(info.ips); if(alldata.ips.length > 100) alldata.ips.shift();
	alldata.Ko_s.push(info.Ko_s); if(alldata.Ko_s.length > 100) alldata.Ko_s.shift();
	alldata.Ko_r.push(info.Ko_r); if(alldata.Ko_r.length > 100) alldata.Ko_r.shift();
	
	plot(e.find(".plot_ips"), alldata.ips, "red");
	plot(e.find(".plot_kos"), alldata.Ko_s, "green", fmt_ko);
	plot(e.find(".plot_kor"), alldata.Ko_r, "blue", fmt_ko);
	
	for(var n = 0; n < ngh.nodes.length; n++) {
		update_agml_info_node(group_name, host_name, cls, n, ngh.nodes[n]);
	}
}

function update_agml_info_node_group(group) {
	var group_name = group.name;
	var nb_hosts = group.hosts.length;
	for(var h = 0; h < nb_hosts; h++) {
		var ngh = group.hosts[h];
		update_agml_info_node_group_host(group_name, ngh, group.cls);
	}
}

function update_agml_info(host) {
	var cmd = "agml " + host + " infos";
	exec_async(cmd, function(error, stdout, stderr){
		$("#content_table").children().addClass("should_disappear");
		if(stdout.length>0) {
			var infos = JSON.parse(stdout);
			for(var g = 0; g < infos.length; g++) {
				update_agml_info_node_group(infos[g]);
			} 
		} else $("#errors").append(stderr+"<br>");
		$("#content_table").children(".should_disappear").remove();
	});
}

function update_providers() {
	var a = get_list_data("#infos_providers");
	NB_INFOS = 0;
	for(var i=0; i<a.length; i++) {
		var provider = a[i]; 
		if(provider.startsWith("agmlinfo://")) {
			var host = provider.slice("agmlinfo://".length);
			ROOT_HOST = host;
			update_agml_info(host);
		} 
	}
}


function update_eval_data() {
	var a = get_list_data("#eval_data");
	EVAL_DATA = {};
	for(var i=0; i<a.length; i++) {
		if(!a[i]) continue;
		var v = a[i].split("=");
		if(v.length && v.length==2) EVAL_DATA[v[0].trim()] = v[1].trim();
	}
}

function main() {
	nwin.show();
	nwin.maximize();
	
	link_list_to_file("#infos_providers", "~/.agml/info_providers.txt", update_providers);
	link_list_to_file("#eval_data", "~/.agml/eval_data.txt", update_eval_data);
	
	setInterval(update_providers, 1000);
//	setInterval(update_eval_data, 1000);
	
	
}


function add_widget(title, content) {
	$("#content").append("<div class='widget'><h3>"+title+"</h3>"+content+"</div>");
}

function get_widget(title) {
	var e = $("#content").children('.widget').children('h3:contains("'+title+'")');
	if(e.length>=1) return e.eq(0).parent();
	return null;
}

$(function() {
	$( "#content").append("<table >" +
			"<thead>" +
			"<th></th><th>Name</th><th>Nb nodes</th><th>Node Class</th>" +
			"<th>nbProcess</th><th>nbSend</th><th>nbRecv</th>" +
			"<th>Iterations per sec.</th><th>Send</th><th>Recv</th>" +
			"<th>var1</th><th>var2</th>"+
			"<th>Request</th>" +
			"</thead>" +
			"<tbody id='content_table'></tbody>" +
			"</table>");
	$( "#content" ).sortable();
//	$( "#content" ).disableSelection();
});

//////////////////


