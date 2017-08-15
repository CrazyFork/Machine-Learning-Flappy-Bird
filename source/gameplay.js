/*

* [phaser api](http://phaser.io/docs/2.6.2/index)
*/

/***********************************************************************************
/* Create a new Phaser Game on window load
/***********************************************************************************/

window.onload = function () {
	// 真正的画布面基, 出去计分板 width = 1280 - 370 = 910, height = 710 - 100, 610
	// bird coordinate is, x = 150, y = 300 + idx * 20
	var game = new Phaser.Game(1280, 720, Phaser.CANVAS, 'game');
	
	game.state.add('Main', App.Main);
	game.state.start('Main');
};

/***********************************************************************************
/* Main program
/***********************************************************************************/

var App = {};

App.Main = function(game){
	this.STATE_INIT = 1;
	this.STATE_START = 2;
	this.STATE_PLAY = 3;
	this.STATE_GAMEOVER = 4;
	
	this.BARRIER_DISTANCE = 300;
}

App.Main.prototype = {
	preload : function(){
		// 36*36 是每一个鸟的大小, 20是总的个数, 一只鸟的状态只有2 column, 10*2
		this.game.load.spritesheet('imgBird', 'assets/img_bird.png', 36, 36, 20);
		// 树同样 90x400*2个
		this.game.load.spritesheet('imgTree', 'assets/img_tree.png', 90, 400, 2);
		this.game.load.spritesheet('imgButtons', 'assets/img_buttons.png', 110, 40, 3);
		
		this.game.load.image('imgTarget', 'assets/img_target.png');//最佳目标点，即gap的中间
		this.game.load.image('imgGround', 'assets/img_ground.png');
		this.game.load.image('imgPause', 'assets/img_pause.png');
		this.game.load.image('imgLogo', 'assets/img_logo.png');
		
		this.load.bitmapFont('fnt_chars_black', 'assets/fnt_chars_black.png', 'assets/fnt_chars_black.fnt');
		this.load.bitmapFont('fnt_digits_blue', 'assets/fnt_digits_blue.png', 'assets/fnt_digits_blue.fnt');
		this.load.bitmapFont('fnt_digits_green', 'assets/fnt_digits_green.png', 'assets/fnt_digits_green.fnt');
		this.load.bitmapFont('fnt_digits_red', 'assets/fnt_digits_red.png', 'assets/fnt_digits_red.fnt');
	},
	
	create : function(){
		// set scale mode to cover the entire screen
		this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
		this.scale.pageAlignVertically = true;
		this.scale.pageAlignHorizontally = true;

		// set a blue color for the background of the stage
		this.game.stage.backgroundColor = "#89bfdc";
		
		// keep game running if it loses the focus
		this.game.stage.disableVisibilityChange = true;
		
		// start the Phaser arcade physics engine
		this.game.physics.startSystem(Phaser.Physics.ARCADE);

		// set the gravity of the world
		this.game.physics.arcade.gravity.y = 1300;
		
		// create a new Genetic Algorithm with a population of 10 units which will be evolving by using 4 top units
		this.GA = new GeneticAlgorithm(10, 4);
		
		// create a BirdGroup which contains a number of Bird objects
		// only add birds to group, when game state is set to play, each bird's reset will be called, set each x to 150
		this.BirdGroup = this.game.add.group();
		for (var i = 0; i < this.GA.max_units; i++){
			this.BirdGroup.add(new Bird(this.game, 0, 0, i));
		}		
	
		// create a BarrierGroup which contains a number of Tree Groups
		// (each Tree Group contains a top and bottom Tree object)
		this.BarrierGroup = this.game.add.group();		
		for (var i = 0; i < 4; i++){
			new TreeGroup(this.game, this.BarrierGroup, i);
		}
		
		// create a Target Point sprite
		this.TargetPoint = this.game.add.sprite(0, 0, 'imgTarget');
		this.TargetPoint.anchor.setTo(0.5);
		
		// create a scrolling Ground object
		this.Ground = this.game.add.tileSprite(0, this.game.height-100, this.game.width-370, 100, 'imgGround');
		this.Ground.autoScroll(-200, 0);
		
		// create a BitmapData image for drawing head-up display (HUD) on it
		this.bmdStatus = this.game.make.bitmapData(370, this.game.height);
		this.bmdStatus.addToWorld(this.game.width - this.bmdStatus.width, 0);
		
		// create text objects displayed in the HUD header
		// http://phaser.io/docs/2.6.2/Phaser.Text.html
		new Text(this.game, 1047, 10, "In1  In2  Out", "right", "fnt_chars_black"); // Input 1 | Input 2 | Output
		// Generation Pre
		this.txtPopulationPrev = new Text(this.game, 1190, 10, "", "right", "fnt_chars_black"); // No. of the previous population
		// Generation Current
		this.txtPopulationCurr = new Text(this.game, 1270, 10, "", "right", "fnt_chars_black"); // No. of the current population
		
		// create text objects for each bird to show their info on the HUD
		this.txtStatusPrevGreen = [];	// array of green text objects to show info of top units from the previous population
		this.txtStatusPrevRed = [];		// array of red text objects to show info of weak units from the previous population
		this.txtStatusCurr = [];		// array of blue text objects to show info of all units from the current population
		
		for (var i=0; i<this.GA.max_units; i++){
			var y = 46 + i*50;
			
			new Text(this.game, 1110, y, "Fitness:\nScore:", "right", "fnt_chars_black")
			// green & red 是重叠的
			this.txtStatusPrevGreen.push(new Text(this.game, 1190, y, "", "right", "fnt_digits_green"));
			this.txtStatusPrevRed.push(new Text(this.game, 1190, y, "", "right", "fnt_digits_red"));
			// 当前的分值是蓝色的
			this.txtStatusCurr.push(new Text(this.game, 1270, y, "", "right", "fnt_digits_blue"));
		}
		
		// create a text object displayed in the HUD footer to show info of the best unit ever born
		this.txtBestUnit = new Text(this.game, 1095, 580, "", "center", "fnt_chars_black");
		
		// create buttons
		this.btnRestart = this.game.add.button(920, 620, 'imgButtons', this.onRestartClick, this, 0, 0);
		this.btnMore = this.game.add.button(1040, 620, 'imgButtons', this.onMoreGamesClick, this, 2, 2);
		this.btnPause = this.game.add.button(1160, 620, 'imgButtons', this.onPauseClick, this, 1, 1);
		this.btnLogo = this.game.add.button(910, 680, 'imgLogo', this.onMoreGamesClick, this);
		
		// create game paused info
		this.sprPause = this.game.add.sprite(455, 360, 'imgPause');
		this.sprPause.anchor.setTo(0.5);
		this.sprPause.kill();
		
		// add an input listener that can help us return from being paused
		this.game.input.onDown.add(this.onResumeClick, this);
				
		// set initial App state
		this.state = this.STATE_INIT;
	},
	
	update : function(){		
		switch(this.state){
			case this.STATE_INIT: // init genetic algorithm
				this.GA.reset();
				this.GA.createPopulation();
				
				this.state = this.STATE_START;
				break;
				
			case this.STATE_START: // start/restart the game
				// update text objects
				this.txtPopulationPrev.text = "GEN "+(this.GA.iteration-1);
				this.txtPopulationCurr.text = "GEN "+(this.GA.iteration);
				
				this.txtBestUnit.text = 
					"The best unit was born in generation "+(this.GA.best_population)+":"+
					"\nFitness = "+this.GA.best_fitness.toFixed(2)+" / Score = " + this.GA.best_score;
				
				// reset score and distance
				this.score = 0;
				this.distance = 0;
				
				// reset barriers
				this.BarrierGroup.forEach(function(barrier){
					barrier.restart(700 + barrier.index * this.BARRIER_DISTANCE);
				}, this);
				
				// define pointer to the first barrier
				this.firstBarrier = this.BarrierGroup.getAt(0);
				
				// define pointer to the last barrier
				this.lastBarrier = this.BarrierGroup.getAt(this.BarrierGroup.length-1);
				
				// define pointer to the current target barrier
				this.targetBarrier = this.firstBarrier;
				
				// start a new population of birds
				this.BirdGroup.forEach(function(bird){
					bird.restart(this.GA.iteration);
					// display green if pre iteration is winner or red a loser
					if (this.GA.Population[bird.index].isWinner){
						this.txtStatusPrevGreen[bird.index].text = bird.fitness_prev.toFixed(2)+"\n" + bird.score_prev;
						this.txtStatusPrevRed[bird.index].text = "";
					} else {
						this.txtStatusPrevGreen[bird.index].text = "";
						this.txtStatusPrevRed[bird.index].text = bird.fitness_prev.toFixed(2)+"\n" + bird.score_prev;
					}
				}, this);
							
				this.state = this.STATE_PLAY;
				break;
				
			case this.STATE_PLAY: // play Flappy Bird game by using genetic algorithm AI
				// update position of the target point
				// 目标点在每个barrier 的 gap 的中间后边位置, x = barrier.x + barrier.width , y = barrier_bottom.y - gap.height/2
				this.TargetPoint.x = this.targetBarrier.getGapX();
				this.TargetPoint.y = this.targetBarrier.getGapY();
				
				var isNextTarget = false; // flag to know if we need to set the next target barrier
				
				this.BirdGroup.forEachAlive(function(bird){
					// calculate the current fitness and the score for this bird
					// 飞行距离 - 距离目标点的距离
					bird.fitness_curr = this.distance - this.game.physics.arcade.distanceBetween(bird, this.TargetPoint);
					bird.score_curr = this.score; //通过一个barrier就加一
					
					// check collision between a bird and the target barrier
					this.game.physics.arcade.collide(bird, this.targetBarrier, this.onDeath, null, this);
					
					if (bird.alive){
						// check if a bird passed through the gap of the target barrier
						if (bird.x > this.TargetPoint.x) isNextTarget = true;
						
						// 610 = GameHeight(710) - GroudHeight(100)
						// check if a bird flies out of vertical bounds
						if (bird.y<0 || bird.y>610) this.onDeath(bird);
						
						// perform a proper action (flap yes/no) for this bird by activating its neural network
						this.GA.activateBrain(bird, this.TargetPoint);
					}
				}, this);
				
				// if any bird passed through the current target barrier then set the next target barrier
				if (isNextTarget){
					this.score++;
					this.targetBarrier = this.getNextBarrier(this.targetBarrier.index);
				}
				
				// if the first barrier went out of the left bound then restart it on the right side
				if (this.firstBarrier.getWorldX() < -this.firstBarrier.width){
					this.firstBarrier.restart(this.lastBarrier.getWorldX() + this.BARRIER_DISTANCE);
					
					this.firstBarrier = this.getNextBarrier(this.firstBarrier.index);
					this.lastBarrier = this.getNextBarrier(this.lastBarrier.index);
				}
				
				// increase the travelled distance
				// 移动的距离, 因为距离总是用第一个barrier的deltaX（即上一次渲染的x和当前渲染的x的差值）相加的结果, 本身
				// 鸟是不移动的，只是背景移动, 即移动 barrier
				this.distance += Math.abs(this.firstBarrier.topTree.deltaX);
				
				this.drawStatus();				
				break;
				
			case this.STATE_GAMEOVER: // when all birds are killed evolve the population
				this.GA.evolvePopulation();
				this.GA.iteration++;
					
				this.state = this.STATE_START;
				break;
		}
	},
	
	drawStatus : function(){
		// 计分板最上面的灰度的背景
		this.bmdStatus.fill(180, 180, 180); // clear bitmap data by filling it with a gray color
		this.bmdStatus.rect(0, 0, this.bmdStatus.width, 35, "#8e8e8e"); // draw the HUD header rect
			
		this.BirdGroup.forEach(function(bird){
			var y = 85 + bird.index*50;
								
			this.bmdStatus.draw(bird, 25, y-25); // draw bird's image
			this.bmdStatus.rect(0, y, this.bmdStatus.width, 2, "#888"); // draw line separator
			
			if (bird.alive){
				var brain = this.GA.Population[bird.index].toJSON();
				var scale = this.GA.SCALE_FACTOR*0.02; // resize to [0, 40]
				// 鸟对应 target point 的 x 距离的值的比重
				this.bmdStatus.rect(62, y, 9, -(50 - brain.neurons[0].activation/scale), "#000088"); // input 1
				// 鸟对应 target point 的 y 距离的值的比重
				this.bmdStatus.rect(90, y, 9, brain.neurons[1].activation/scale, "#000088"); // input 2
				
				// 最后的neuron阀值小于0.5则不flap, 显示红色
				if (brain.neurons[brain.neurons.length-1].activation<0.5) this.bmdStatus.rect(118, y, 9, -20, "#880000"); // output: flap = no
				// 显示绿色
				else this.bmdStatus.rect(118, y, 9, -40, "#008800"); // output: flap = yes
			}
			
			// draw bird's fitness and score
			this.txtStatusCurr[bird.index].setText(bird.fitness_curr.toFixed(2)+"\n" + bird.score_curr);
		}, this);
	},
	
	getNextBarrier : function(index){
		return this.BarrierGroup.getAt((index + 1) % this.BarrierGroup.length);
	},
	
	onDeath : function(bird){
		this.GA.Population[bird.index].fitness = bird.fitness_curr;
		this.GA.Population[bird.index].score = bird.score_curr;
					
		bird.death();
		if (this.BirdGroup.countLiving() == 0) this.state = this.STATE_GAMEOVER;
	},
	
	onRestartClick : function(){
		this.state = this.STATE_INIT;
    },
	
	onMoreGamesClick : function(){
		window.open("http://www.askforgametask.com", "_blank");
	},
	
	onPauseClick : function(){
		this.game.paused = true;
		this.btnPause.input.reset();
		// 游戏主界面显示的pause提示, 默认是kill的状态，即不显示, 当resume的时候，从新激活
		this.sprPause.revive();
    },
	
	onResumeClick : function(){
		if (this.game.paused){
			this.game.paused = false;
			this.btnPause.input.enabled = true;
			this.sprPause.kill();
		}
    }
}

/***********************************************************************************
/* TreeGroup Class extends Phaser.Group
/***********************************************************************************/	
// http://phaser.io/docs/2.6.2/Phaser.Group.html	
var TreeGroup = function(game, parent, index){
	Phaser.Group.call(this, game, parent);

	this.index = index;

	this.topTree = new Tree(this.game, 0); // create a top Tree object
	this.bottomTree = new Tree(this.game, 1); // create a bottom Tree object
	
	this.add(this.topTree); // add the top Tree to this group
	this.add(this.bottomTree); // add the bottom Tree to this group
};

TreeGroup.prototype = Object.create(Phaser.Group.prototype);
TreeGroup.prototype.constructor = TreeGroup;

TreeGroup.prototype.restart = function(x) {
	// a single tree is 90*400
	this.topTree.reset(0, 0);
	this.bottomTree.reset(0, this.topTree.height + 130);// 130 = Gap ?, it should be

	this.x = x;
	// [-390, -20]
	this.y = this.game.rnd.integerInRange(110-this.topTree.height, -20);
	// move tree -200px per second to left ?
	this.setAll('body.velocity.x', -200);
};

TreeGroup.prototype.getWorldX = function() {
	return this.topTree.world.x;
};

TreeGroup.prototype.getGapX = function() {
	return this.bottomTree.world.x + this.bottomTree.width;
};

TreeGroup.prototype.getGapY = function() {
	return this.bottomTree.world.y - 65; // gap middle ?, 130/2
};

/***********************************************************************************
/* Tree Class extends Phaser.Sprite
/***********************************************************************************/

var Tree = function(game, frame) {
	Phaser.Sprite.call(this, game, 0, 0, 'imgTree', frame);
	
	this.game.physics.arcade.enableBody(this);
	
	this.body.allowGravity = false;
	this.body.immovable = true;
};

Tree.prototype = Object.create(Phaser.Sprite.prototype);
Tree.prototype.constructor = Tree;

/***********************************************************************************
/* Bird Class extends Phaser.Sprite
/***********************************************************************************/

var Bird = function(game, x, y, index) {
	// x,y is the coordinate in the world space
	Phaser.Sprite.call(this, game, x, y, 'imgBird');
	   
	this.index = index;
	/*
	The anchor sets the origin point of the texture.
	The default is 0,0 this means the texture's origin is the top left
	Setting than anchor to 0.5,0.5 means the textures origin is centered
	Setting the anchor to 1,1 would mean the textures origin points will be the bottom right corner
	*/
	this.anchor.setTo(0.5);
	  
	// add flap animation and start to play it
	var i=index*2;
	// 因为就2帧，鸟的动画，所以是[i, i+1]
	this.animations.add('flap', [i, i+1]);
	this.animations.play('flap', 8, true);

	// enable physics on the bird
	// http://phaser.io/docs/2.6.2/Phaser.Physics.html
	// this.game.physics: Phaser.Physics
	this.game.physics.arcade.enableBody(this);
};

Bird.prototype = Object.create(Phaser.Sprite.prototype);
Bird.prototype.constructor = Bird;

Bird.prototype.restart = function(iteration){
	this.fitness_prev = (iteration == 1) ? 0 : this.fitness_curr;
	this.fitness_curr = 0;
	
	this.score_prev = (iteration == 1) ? 0: this.score_curr;
	this.score_curr = 0;
	
	this.alpha = 1;
	// world coordinate, x, y
	this.reset(150, 300 + this.index * 20);
};

Bird.prototype.flap = function(){
	// 这应该跟物理引擎相关，位置减去400px感觉不对
	// http://phaser.io/docs/2.6.2/Phaser.Physics.Arcade.Body.html#velocity
	// The velocity, or rate of change in speed of the Body. Measured in pixels per second.
	this.body.velocity.y = -400;
};

Bird.prototype.death = function(){
	this.alpha = 0.5;
	// A killed Game Object has its alive, exists and visible properties all set to false.
	this.kill();
};

/***********************************************************************************
/* Text Class extends Phaser.BitmapText
/***********************************************************************************/

var Text = function(game, x, y, text, align, font){
	Phaser.BitmapText.call(this, game, x, y, font, text, 16);
	
	this.align = align;
	
	if (align == "right") this.anchor.setTo(1, 0);
	else this.anchor.setTo(0.5);
	
	this.game.add.existing(this);
};

Text.prototype = Object.create(Phaser.BitmapText.prototype);
Text.prototype.constructor = Text;

