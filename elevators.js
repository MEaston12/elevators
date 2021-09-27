module.exports = 7; //Challenge number to start at
const code = {
  init: function (elevators, floors) {
    const AVG_WEIGHT = (100 + 55) / 2;
    const EST_ENTERING = 2;

    const CHALLENGE_NO = parseInt(window.location.href.match(/=(\d+)/)?.[1] || '1');
    //Boolean values to enable special behavior depending on challenge objective
    const maxThru = [1, 2, 3, 4, 5, 10, 16, 17].includes(CHALLENGE_NO);
    const fewMoves = [6, 7].includes(CHALLENGE_NO);
    const lowWait = [8, 9, 11, 12, 13, 14, 15].includes(CHALLENGE_NO);
    
    const ticketList = {
      up: [],
      down: [],
      add(floorNum, direction) {
        ticketList[direction].push(new Ticket(floorNum));
        ticketList[direction].sort((a, b) => (a.floorNum < b.floorNum) ? -1 : 1);
      },
      remove(floorNum, direction) {
        ticketList[direction] = ticketList[direction].filter(ticket => ticket.floorNum != floorNum);
      }
    }

    class Ticket {
      constructor(floorNum) {
        this.floorNum = floorNum;
        this.timestamp = Date.now();
      }
    }

    class Route {
      constructor(start, end, dummy = false) {
        this.start = start;
        this.end = end;
        this.dir = (start < end) ? 'up' : (start === 0) ? 'up' : 'down';
        this.done = dummy;
      }
      begin(elevator) {
        elevator.setIndicator(this.dir);
        elevator.relocating = false;
        if(elevator.currentFloor() != this.start) {
          elevator.relocating = true;
        }
        if(!fewMoves || elevator.currentFloor() !== this.start) elevator.goToFloor(this.start);
        elevator.goToFloor(this.end);
      }
    }

    function addDeliver(floorNum, elevator) {
      //Check if delivery point is beyond our current route, if so, reroute to that target
      if(elevator.destinationQueue.length === 0) {
        elevator.goToFloor(floorNum);
        return;
      }
      const currDest = elevator.destinationQueue[0];
      if((elevator.route.dir === 'up' && floorNum > currDest) ||
        (elevator.route.dir === 'down' && floorNum < currDest)) 
      {
        elevator.route.end = floorNum;
        elevator.destinationQueue = [];
        elevator.checkDestinationQueue();
        elevator.goToFloor(floorNum);
      } else {
        elevator.goToFloor(floorNum);
      }
    }
    function chartRoute(elevator) {
      //Determine location to begin, then goToFloor top floor of the run
      //  Need to look at ticketList and take tickets based on route
      if(!elevator.route.done) {
        console.log(`Elevator ${elevator.num} is idling but still on route.`)
        return; //If we're already on a route, don't chart a new one.
      }
      if (ticketList.up.length === 0 && ticketList.down.length === 0) {
        //If ticketlist is empty, true idle behavior here
        elevator.goToFloor(elevator.num % floors.length);
        elevator.setIndicator('');
        console.log(`Elevator ${elevator.num} going home.`);
        return;
      }
      const currFloor = elevator.currentFloor();
      let upDest;
      let upStart;
      let downDest;
      let downStart;
      let distToUp = 100;
      let distToDown = 100;
      if(ticketList.up.length) {
        upDest = ticketList.up.at(-1).floorNum;
        upStart = ticketList.up.at(0).floorNum;
        if (upDest && (upStart === upDest)) upDest++;
        distToUp = Math.abs(currFloor - upStart);
      }
      if(ticketList.down.length) {
        downDest = ticketList.down.at(0).floorNum;
        downStart = ticketList.down.at(-1).floorNum;
        if (downDest && (downStart === downDest)) downDest--;
        distToDown = Math.abs(currFloor - downStart);
      }
      if ((elevator.goingUpIndicator() && ticketList.up.includes(currFloor)) || 
        (elevator.goingDownIndicator() && ticketList.down.includes(currFloor))) {
        //Route will need to start here as people have already boarded
        upStart = currFloor;
        downStart = currFloor;
        distToUp = Math.abs(currFloor - upStart);
        distToDown = Math.abs(currFloor - downStart);
      }
      //Route Selection begins here
      if(!ticketList.up.length && ticketList.down.length) {
        console.log('No up tickets detected, defaulting to down ticket.',downStart, downDest);
        elevator.route = new Route(downStart, downDest);
      }
      else if(!ticketList.down.length && ticketList.up.length) {
        console.log('No down tickets detected, defaulting to up ticket.', upStart, upDest);
        elevator.route = new Route(upStart, upDest);
      }
      else if(distToUp < distToDown) {
        console.log('Down tickets and up tickets detected, up is closer.', upStart, upDest);
        elevator.route = new Route(upStart, upDest);
      }
      else {
        console.log('Down tickets and up tickets detected, down is closer.', downStart, downDest);
        elevator.route = new Route(downStart, downDest);
      }
      elevator.route.begin(elevator);
    }
    function checkStop(floorNum, elevator) {
      //Function should check to see if we need to stop at a floor before we pass it.
      if (elevator.relocating) return;
      if (elevator.getPressedFloors().includes(floorNum)){
        //If we are delivering passengers, always stop
        elevator.stopAt(floorNum);
        return;
      }
      const dir = elevator.route.dir;
      const tick = ticketList[dir].find(ticket => ticket.floorNum === floorNum);
      if(!tick) return; //If there is no ticket for  this floor, we can pass it
      const freeSeats = elevator.maxPassengerCount() - elevator.loadFactor() / AVG_WEIGHT * elevator.maxPassengerCount() * 100
      const freeWeight = 1 - elevator.loadFactor() * 100;
      //If we don't have enough free seats or weight, pass the floor
      if (EST_ENTERING > freeSeats || EST_ENTERING * 75 > freeWeight) return;
      elevator.stopAt(floorNum);
    }
    function handleStop(floorNum, elevator) {
      elevator.relocating = false;
      if(floorNum === 0) elevator.setIndicator('up');
      if(floorNum === floors.length - 1) elevator.setIndicator('down');
      if(elevator.goingUpIndicator()) ticketList.remove(floorNum, 'up');
      if(elevator.goingDownIndicator()) ticketList.remove(floorNum, 'down');
      if(elevator.route.end === floorNum) elevator.route.done = true;
    }

    //Event binding, shouldn't handle any real logic, just link to functions above
    elevators.forEach((elevator, i) => {
      elevator.on('floor_button_pressed', floorNum => {
        addDeliver(floorNum, elevator);
      });
      elevator.on('passing_floor', (floorNum, direction) => {
        checkStop(floorNum, elevator);
      });
      elevator.on('stopped_at_floor', floorNum => {
        handleStop(floorNum, elevator);
      });
      elevator.on('idle', () => {
        console.log('Elevator ' + i + ' idling');
        if(fewMoves) { //Ensures elevator is full before it takes any action
          setTimeout(() => chartRoute(elevator), 6 * 1000);
        } else {
          chartRoute(elevator);
        }
      });
      elevator.setIndicator = direction => {
        elevator.goingUpIndicator(direction === 'up');
        elevator.goingDownIndicator(direction === 'down');
      }
      elevator.stopAt = floorNum => {
        ticketList.remove(floorNum, elevator.route.dir);
        elevator.goToFloor(floorNum, true);
      }
      elevator.route = new Route(0, 1, true);
      elevator.num = i;
    });
    for (const floor of floors) {
      floor.on('up_button_pressed', () => {
        ticketList.add(floor.floorNum(), 'up');
      });
      floor.on('down_button_pressed', () => {
        ticketList.add(floor.floorNum(), 'down');
      });
    }
  },
  update: function(dt, elevators, floors) {
    // We normally don't need to do anything here
  }
}