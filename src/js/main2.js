var ngui = require('nw.gui');
var nwin = ngui.Window.get();
var sys = require('sys');
var exec_async = require('child_process').exec;
var fs = require('fs');
var path = require('path');


/////////////////////////////////

var SSHFS = [];

var NB_INFOS = 0;
var NODEGROUP_DATA = {};



function update_top() {
	$("#top").html(NB_INFOS + "infos");
}

function get_info(p) {
	var info = null;
	var all = $("#content").find(".path:contains('"+p+"')");
	if(all.length==0) {
		info = $("<li class='info'><div class='path'>"+p+"</div><div class='title'>"+p+"</div><div class='content'></div></li>"); 
		$("#content").append(info);
		info.children(".title").click(function() {info.children(".content").slideToggle();});
	}
	else info = all.eq(0).parent();
	return info;
}



function update_nodegroup_infos(path, opt) {
	var info = get_info(path);
	var cmd = "cat "+ path;
	if(opt=="shm") cmd = "export LC_ALL=en_US.UTF-8; od -f " + path + " | cut -d' ' -f2- | tr '\n' ' ' | sed 's/  */ /g' | sed 's/^ *//g' | sed 's/ *$//g'"; 
	exec_async(cmd, function(error, stdout, stderr){
		var e = info.children('.content');
		var data = stdout.replaceAll("\n", " ").split(" ");
		var relpath = path.slice(path.lastIndexOf("/")+1);
		var t = relpath.split("_");
		var t2 = relpath.slice(relpath.indexOf("_node_")+"_node_".length);
		data = {
				host:t[1]+":"+t[2], thread:t[3],
				nodegroup:t2.split(".")[0],
				id:t2.split(".")[1],
				nbProcess:data[0],nbSend:data[1],nbRecv:data[2],
				ips:data[3], Ko_s:data[4], Ko_r:data[5]
		};
		alldata = NODEGROUP_DATA[path];
		if(!alldata) alldata = NODEGROUP_DATA[path] = {};
		if(!alldata.ips) alldata.ips = [];
		if(!alldata.Ko_s) alldata.Ko_s = [];
		if(!alldata.Ko_r) alldata.Ko_r = [];
		alldata.ips.push(data.ips); if(alldata.ips.length > 100) alldata.ips.shift();
		alldata.Ko_s.push(data.Ko_s); if(alldata.Ko_s.length > 100) alldata.Ko_s.shift();
		alldata.Ko_r.push(data.Ko_r); if(alldata.Ko_r.length > 100) alldata.Ko_r.shift();
		
		// Display infos
		info.children('.title').html(data.nodegroup + " (" + data.id + ")");
		info.children('.title').addClass("node_"+data.nodegroup);
		
		var str = "";
		for(var i in data) {
			if(i!="ips" && i!="Ko_s" && i!="Ko_r") str += '<b>' + i + '</b> : ' + data[i] + "<br>";
		}
		e.append(str);
		var perf_table = create_table([
		["<canvas class='plot_ips'></canvas>","<canvas class='plot_kos'></canvas>","<canvas class='plot_kor'></canvas>"],
		["<div class='title'>it. per seconds</div>","<div class='title'>Send (Ko/s)</div>","<div class='title'>Recv (Ko/s)</div>"]
		]);
		e.append(perf_table);
		plot(perf_table.find(".plot_ips"), alldata.ips, "green");
		plot(perf_table.find(".plot_kos"), alldata.Ko_s, "red", fmt_ko);
		plot(perf_table.find(".plot_kor"), alldata.Ko_r, "blue", fmt_ko);
	});
}


//////////////////////////


function get_info2(p) {
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

function update_nodegroup_infos2(path, opt) {
	var e = get_info2(path);
	var cmd = "cat "+ path;
	if(opt=="shm") cmd = "export LC_ALL=en_US.UTF-8; od -f " + path + " | cut -d' ' -f2- | tr '\n' ' ' | sed 's/  */ /g' | sed 's/^ *//g' | sed 's/ *$//g'"; 
	exec_async(cmd, function(error, stdout, stderr){
		var data = stdout.replaceAll("\n", " ").split(" ");
		var relpath = path.slice(path.lastIndexOf("/")+1);
		var t = relpath.split("_");
		var t2 = relpath.slice(relpath.indexOf("_node_")+"_node_".length);
		
		data = {
				nodegroup : t2.split(".")[0],
				id : t2.split(".")[1],
				host:t[1]+":"+t[2], thread:t[3],
				ips:data[3], 
				Ko_s:(data[4]>1000 ? Math.round(data[4]/100.0)/10 + "MB/s" : data[4] + "KB/s"), 
				Ko_r:(data[5]>1000 ? Math.round(data[5]/100.0)/10 + "MB/s" : data[5] + "KB/s"),
				nbProcess:data[0],nbSend:data[1],nbRecv:data[2],
				
				moy:data[6],std:data[7]
		};
		
		alldata = NODEGROUP_DATA[path];
		if(!alldata) alldata = NODEGROUP_DATA[path] = {};
		if(!alldata.ips) alldata.ips = [];
		if(!alldata.Ko_s) alldata.Ko_s = [];
		if(!alldata.Ko_r) alldata.Ko_r = [];
		alldata.ips.push(data.ips); if(alldata.ips.length > 100) alldata.ips.shift();
		alldata.Ko_s.push(data.Ko_s); if(alldata.Ko_s.length > 100) alldata.Ko_s.shift();
		alldata.Ko_r.push(data.Ko_r); if(alldata.Ko_r.length > 100) alldata.Ko_r.shift();
		
		var str = "<td class='path'>" + path + "</td>";

		for(var i in data) {
			str += '<td>';
//			if(i=="ips") str += "<canvas class='plot_ips'></canvas>";
//			else if(i=="Ko_s") str += "<canvas class='plot_kos'></canvas>";
//			else if(i=="Ko_r") str += "<canvas class='plot_kor'></canvas>";
//			else 
				str+= data[i]; 
			str+= '</td> ';
		}
		e.html(str);
//		plot(e.find(".plot_ips"), alldata.ips, "green");
//		plot(e.find(".plot_kos"), alldata.Ko_s, "red");
//		plot(e.find(".plot_kor"), alldata.Ko_r, "blue");
	});
}


function update_agml_info_node(node) {
}

function update_agml_info_node_group_host(ngh) {
	var host_name = ngh.name;
	var nb_nodes = parseInt(ngh.nb_nodes);
	var info = ngh.infos;
	for(var n = 0; n < ngh.nodes.length; n++) {
		update_agml_info_node(ngh.nodes[n]);
	}
}

function update_agml_info_node_group(group) {
	var group_name = group.name;
	var nb_hosts = group.hosts.length;
	for(var h = 0; h < nb_hosts; h++) {
		var ngh = group.hosts[h];
		update_agml_info_node_group_host(ngh);
	}
}

function update_agml_info(host) {
	var cmd = "agml " + host + " infos";
	exec_async(cmd, function(error, stdout, stderr){
		var infos = JSON.parse(stdout);
		for(var g = 0; g < infos.length; g++) {
			update_agml_info_node_group(infos[g]);
		}
	}
}

function update_providers() {
	var a = get_list_data("#infos_providers");
	NB_INFOS = 0;
	for(var i=0; i<a.length; i++) {
		var provider = a[i]; 
		if(provider.startsWith("ssh://")) {
			var ssh = ssh_host_decode(provider);
			var sshfs = SSHFS[ssh.enc];
			if(!sshfs) sshfs = SSHFS[provider] = {
					host: ssh.host,
					path: ssh.path,
					mount_point: "/tmp/agml_mount_"+ssh.enc,
					connected: false
			};
			sshfs_connect(sshfs, function() {
				list_dir_filter(sshfs.mount_point, "agml*", function(p) {
					for(var j=0; j<p.length; j++) {
						if(p[j].trim().length != 0) update_nodegroup_infos2(p[j]);
						
						NB_INFOS++;
						update_top();
					}
				});
			});
		}
		else if(provider.startsWith("shm://")) {
			var path = provider.slice("shm://".length);
			list_dir_filter(path, "agml*", function(p) {
				for(var j=0; j<p.length; j++) {
					if(p[j].trim().length != 0) update_nodegroup_infos2(p[j], "shm");
					
					NB_INFOS++;
					update_top();
				}
			});
		}
		else if(provider.startsWith("agmlinfo://")) {
			var host = provider.slice("agmlinfo://".length);
			update_agml_info(host);
		} else list_dir_filter(provider, "agml*", function(p) {
			for(var j=0; j<p.length; j++) {
				if(p[j].trim().length != 0) update_nodegroup_infos2(p[j]);
				
				NB_INFOS++;
				update_top();
			}
		});
	}

}


function main() {
	nwin.show();
	nwin.maximize();
	
	link_list_to_file("#infos_providers", "~/.agml/info_providers.txt", update_providers);
	
	setInterval(update_providers, 1000);
}

$(function() {
	$( "#content").append("<table >" +
			"<thead>" +
			"<th>Node</th><th>Id</th><th>Host</th><th>Thread</th>" +
			"<th>Iterations per sec.</th><th>Send</th><th>Recv</th>" +
			"<th>nbProcess</th><th>nbSend</th><th>nbRecv</th><th>moy</th><th>std</th>" +
			"</thead>" +
			"<tbody id='content_table'></tbody>" +
			"</table>");
	$( "#content" ).sortable();
//	$( "#content" ).disableSelection();
});

//////////////////


