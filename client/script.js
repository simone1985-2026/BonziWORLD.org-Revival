let socket = io("//");
let moving = false;
let error_id = "error_disconnect";
let level = 0;
let target;
const agents = {   
};

//Type of each color
const types = {
    "purple": "bonzi",
    "red": "bonzi",
    "pink": "bonzi",
    "blue": "bonzi",
    "black": "bonzi",
    "brown": "bonzi",
    "green": "bonzi",
    "pope": "bonzi",
	  "peedy": "peedy",
    "clippy": "clippy"
}

//Set up stylesheets
const sheets = {
    bonzi:{
        spritew: 200,
        spriteh: 160,
        w: 3400,
        h: 3360,
        toppad: 0,
        anims: [
       	    [0].concat(range(16, 39)),
   	        range(277, 302).concat([0])
		],
    },
    peedy: {
        spritew: 160,
        spriteh: 128,
        w: 4000,
        h: 4095,
        toppad: 12,
        anims: [
            [0].concat(range(23, 46)),
           	range(659, 681).concat([0])
        ]
    },
    clippy: {  
        spritew: 124,
        spriteh: 93,
        w: 3348,
        h: 3162,
        toppad: 40,
        anims: [
            [0].concat(range(364, 411)),
            range(410, 416).concat([0])
        ]
    },
}

//Shortcut, since remainder of jQuery isn't worth importing
function $(id){
	return document.getElementById(id);
}

//Primitive approach to linkifying a message
function linkify(msg){
    msg = msg.split(" ");
    let nmsg = [];
    msg.forEach(word=>{
        if(word.startsWith("http://") || word.startsWith("https://")){
            nmsg.push("<a href='"+word+"' target='_blank'>"+word+"</a>")
        }
        else nmsg.push(word);
    })
    return nmsg.join(" ");
}

class agent{
    constructor(name, id, x, y, sheet, image, voice){
        this.x = x;
        this.y = y;
        this.toppad = sheet.toppad;
        this.w = sheet.spritew;
    	this.h = sheet.spriteh;
    	this.id = id;
        this.image = image;
        this.voice = voice;
        this.name = name;
        this.lx = x;
        this.ly = y;
    	this.styleobject = new styleobject(this.w, this.h, sheet.w, sheet.h, "./img/agents/"+image+".png", sheet.anims);
    	let bubbleclass = (x > innerWidth/2-this.w/2) ? "bubble-left" : "bubble-right";
    	$("agent_content").insertAdjacentHTML("beforeend", `
    		<div id='`+id+`p' style='top:`+y+`;left:`+x+`;height: `+(this.h+sheet.toppad)+`px;width: `+this.w+`px;' class='agent_cont'>
    		<span class='nametag' id='`+id+`n'>`+name+`</span>
    		<span class='`+bubbleclass+`' style='display: none;' id='`+id+`b' >
    		<p id='`+id+`t' class='bubble_text'></p>
    		</span>
            <audio style='display: none;' id='`+id+`a'></audio>
    		</div>
    		`);
	    this.styleobject.enter(id+"c", id+"p", 1, 70, sheet.anims[1][0]);
        $(this.id+"c").onclick = ()=>{this.cancel()};

        //Move starter
        $(this.id+"c").addEventListener("touchstart", mouse=>{movestart(mouse, this)});
        $(this.id+"c").addEventListener("mousedown", mouse=>{movestart(mouse, this)});
    }
    update(){
        $(this.id+"p").style.left = this.x;
        $(this.id+"p").style.top = this.y;
    }
    change(image){
        let sheet = sheets[types[image]];
        this.w = sheet.spritew;
        this.h = sheet.spriteh;
        this.toppad = sheet.toppad;
        this.image = image;
        //Re-create styleobject
        this.styleobject.kill();
        this.styleobject = new styleobject(this.w, this.h, sheet.w, sheet.h, "./img/agents/"+image+".png", sheet.anims);
        this.styleobject.enter(this.id+"c", this.id+"p", 1, 0, 0);
        //Re-size parent
        $(this.id+"p").style.width = this.w;
        $(this.id+"p").style.height = this.h+sheet.toppad;
        poscheck(this.id);
        //Move starter
        $(this.id+"c").addEventListener("touchstart", mouse=>{movestart(mouse, this)});
        $(this.id+"c").addEventListener("mousedown", mouse=>{movestart(mouse, this)});
    }
    talk(write, say){
    	$(this.id+"b").style.display = "none";
        write = write || "";
        say = say || write;
        if(write.startsWith("-")) say = "";
        else say = desanitize(say);
    	if(say !== "" && speak && speak.play) {
            const speech = speak.play(say, this.id, this.voice);
            if(speech && typeof speech.onended !== 'undefined') {
                speech.onended = () => {
                    $(this.id+"b").style.display = "none";   
                };
            }
        }
    	$(this.id+"t").innerHTML = linkify(write);
    	setTimeout(()=>{$(this.id+"b").style.display = "block"}, 100);
    }
    actqueue(list, i){
        if(i >= list.length) return;
        if(list[i].say == undefined) list[i].say = list[i].text;
        if(list[i].type == 0){
            $(this.id+"b").style.display = "none";
            setTimeout(()=>{
                $(this.id+"t").innerHTML = linkify(list[i].text);
                $(this.id+"b").style.display = "block"
                speak.play(list[i].say, this.id, this.voice).onended = ()=>{
                    $(this.id+"b").style.display = "none";   
                    i++;
                    this.actqueue(list, i);
                };
            }, 100);
        } else{
            this.styleobject.play(list[i].anim, 70).onend = ()=>{
                i++;
                this.actqueue(list, i);
            }
        }
    }
    kill(){
        this.styleobject.play(0, 70).onend = ()=>{
            this.styleobject.kill();
            $(this.id+"p").remove();
            delete agents[this.id];
        }
    } 
    cancel(){
        if(this.lx != this.x && this.ly != this.y) return;
        $(this.id+"a").pause();
        $(this.id+"b").style.display = "none";
    }
}

function poscheck(agent){
        agent = agents[agent];
        if(agent.x > innerWidth-agent.w) agent.x = innerWidth - agent.w
        if(agent.y > innerHeight-32-agent.h) agent.y = innerHeight - 32 - agent.h;
        //Find new bubble location. Only change if new class is different than old (to reduce load).
        if(agent.x > innerWidth/2-agent.w/2) $(agent.id+"b").className = "bubble-left";
        else $(agent.id+"b").className = "bubble-right";
        agent.update();
}

function movestart(mouse, self){
    if(mouse.touches != undefined) mouse = mouse.touches[0];
    target = self;
    let rect = $(self.id+"c").getBoundingClientRect();
    //Find offset of mouse to target
    target.offsetx = mouse.clientX - rect.left;
    target.offsety = mouse.clientY - rect.top + target.toppad;
    //Set rect
    target.rect = rect;
    target.lx = target.x;
    target.ly = target.y;
    //Enable moving
    moving = window.cont == undefined;
}


function mousemove(mouse){
    if(mouse.touches != undefined) mouse = mouse.touches[0];
    if(moving){
        //Find new x. If new x above limits, set it to appropriate limit.
        target.x = mouse.clientX-target.offsetx;
        if(target.x > innerWidth-target.rect.width) target.x = innerWidth - target.rect.width
        else if(target.x < 0) target.x = 0;

        //Do the same as above to Y
        target.y = mouse.clientY-target.offsety;
        if(target.y > innerHeight-32-target.rect.height - target.toppad) target.y = innerHeight - 32 - target.rect.height - target.toppad;
        else if(target.y < 0) target.y = 0;

        //Find new bubble location. Only change if new class is different than old (to reduce changes).
        if(target.x > innerWidth/2-target.w/2) $(target.id+"b").className = "bubble-left";
        else $(target.id+"b").className = "bubble-right";

        //NOTE: Simply ignoring out-of-bound mouse will lead to mistakes when mouse moves off screen. If out of bounds, set to appropriate limit instead.
        target.update();
    }
}
function mouseup(mouse){
    if(mouse.touches != undefined) mouse = mouse.touches[0];
    if(window.cont != undefined && mouse.button != 2){
        window.cont.remove();
        delete window.cont
    }
    moving = false;
}

function movehandler(){
    //Moving
    document.addEventListener("touchmove", mousemove)
    document.addEventListener("mousemove", mousemove)
    document.addEventListener("touchend", mouseup)
    document.addEventListener("mouseup", mouseup)

    //On resize
    window.addEventListener("resize", ()=>{
    	Object.keys(agents).forEach(poscheck)
    })

    //Context menu
    document.addEventListener("contextmenu", mouse=>{
        mouse.preventDefault();
        moving = false;
        //Find agent the mouse is over
        let bid = -1;
        Object.keys(agents).forEach((akey)=>{
            //Check if within bounds of an agent. Pretty long condition.
            if(
                mouse.clientX > agents[akey].x && 
                mouse.clientX < agents[akey].x + agents[akey].w && 
                mouse.clientY > agents[akey].y && 
                mouse.clientY < agents[akey].y + agents[akey].h + agents[akey].toppad
            ) bid = akey;
        })

        //Contextmenu if found passing agent through
        if(bid>-1){
            //Define the contextmenu upon click (so it can be dynamic)
            let cmenu = [
                {
                    type: 0,
                    name: "Cancel",
                    callback: (passthrough)=>{
                        passthrough.cancel();
                    }
                },
                {
                    type: 0,
                    name: "Call an Asshole",
                    callback: (passthrough)=>{
                        socket.emit("command", {command: "asshole", param: passthrough.name})
                    }
                },
                {
                    type: 0,
                    name: "Notice Bulge",
                    callback: (passthrough)=>{
                        socket.emit("command", {command: "owo", param: passthrough.name})
                    }
                },
                {
                    type: 0,
                    name: "Notice Bulge 2",
                    callback: (passthrough)=>{
                        socket.emit("command", {command: "uwu", param: passthrough.name})
                    }
                },
                {
                    type: 0,
                    name: "Kick",
                    disabled: level < 1,
                    callback: (passthrough)=>{
                        socket.emit("command", {command: "kick", param: passthrough.id})
                    }
                }
            ]
            contextmenu(cmenu, mouse.clientX, mouse.clientY, agents[bid]);
        }
    })
}

function talk(){
    let say = $("chatbar").value;
    if(say.startsWith("/")){
        //Parse command
        let cmd = say.split(" ");
        let command = cmd[0].substring(1);
        cmd.splice(0, 1);
        let param = cmd.join(" ");

        socket.emit("command", {command: command, param: param})
    } else{
	   socket.emit("talk", say);
    }
    $("chatbar").value = "";
}

function setup(logindata){
    level = logindata.level;
	//Show main UI
    $("room_name").innerHTML = logindata.roomname;
    $("error_room").innerHTML = logindata.roomname;
	$("room_priv").innerHTML = logindata.roompriv ? "private" : "public";
	$("login").style.display = "none";
	$("content").style.display = "block";
    if(logindata.owner) $("room_owner").style.display = "block";
  	movehandler();

  	//Create agents
   	Object.keys(logindata.users).forEach(userkey=>{
        let user = logindata.users[userkey];
    	let x = Math.floor(Math.random()*(innerWidth-sheets[types[user.color]].spritew));
    	let y = Math.floor(Math.random()*(innerHeight-sheets[types[user.color]].spriteh-32-sheets[types[user.color]].toppad));
		agents[userkey] = new agent(user.name, userkey, x, y, sheets[types[user.color]], user.color, user.voice)
    })

    $("chatbar").addEventListener("keydown", key=>{
    	if(key.which == 13) talk();
    });

    //Socket event listeners
    socket.on("leave", guid=>{
    	agents[guid].kill();
    })
    socket.on("join", user=>{
    	let x = Math.floor(Math.random()*(innerWidth-sheets[types[user.color]].spritew));
    	let y = Math.floor(Math.random()*(innerHeight-sheets[types[user.color]].spriteh-32-sheets[types[user.color]].toppad));
    	agents[user.guid] = new agent(user.name, user.guid, x, y, sheets[types[user.color]], user.color, user.voice)
    })
    socket.on("update", user=>{
        $(agents[user.guid].id+"n").innerHTML = user.name;
        agents[user.guid].voice = user.voice;
        if(user.color != agents[user.guid].image) agents[user.guid].change(user.color)
    })
    socket.on("talk", text=>{
    	agents[text.guid].talk(text.text, text.text);
    })
    socket.on("actqueue", queue=>{
        agents[queue.guid].actqueue(queue.list, 0);
    })
    socket.on("update_self", info=>{
        level = info.level;
    })
    socket.on("kick", kicker=>{
        error_id = "error_kick";
        $("error_kicker").innerHTML = kicker;
    })
}

function start(){
	socket.emit("login", {
		name: $("nickname").value,
		room: $("room").value
	})
    $("login_card").style.display = "none";
    $("loading").style.display = "block";
}

function tile(){
	let x = 0;
	let sx = 0;
	let y = 0;
	Object.keys(agents).forEach(agent=>{
		agent = agents[agent];
		agent.x = x;
		agent.y = y;
		agent.update();
		x+=agent.w;
		if(x>innerWidth-agent.w){
			x=sx;
			y+=agent.h;
		}
		if(y>innerHeight-agent.w-32){
			sx+=20;
			x=sx;
			y=0;
		}
	})
}

//So the speaking isn't affected by sanitization
function desanitize(text){
    return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'");
}

window.onload = ()=>{
	$("loading").style.display = "none";
	$("login_card").style.display = "block";
	socket.on("login", setup);

	//Error Handling
    socket.on("error", error=>{
    	$("login_error").innerHTML = error;
    	$("login_error").style.display = "block";
    })
    socket.on("disconnect", ()=>{
        $("error_page").style.display = "block";
        $(error_id).style.display = "block";
    })
}
