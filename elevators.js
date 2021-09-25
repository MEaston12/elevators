const elev = {
  init: function (elevators, floors) {
    const AVG_WEIGHT = (100 + 55) / 2;
    const EST_ENTERING = 2;
    const CHALLENGE_NO = parseInt(window.location.href.match(/=(\d+)/)?.[1] || '1');

    const deliverMap = Array.from(Array(floors.length), () => Array(elevators.length).fill(false));
    const ticketList = {
      up: Array(floors.length).fill(false),
      down: Array(floors.length).fill(false)
    }

    class Route {
      constructor(start, end){
        this.start = start;
        this.end = end;
        this.dir = (start < end) ? 'up' : 'down';
        this.done = false;
      }
    }

    function addTicket(floorNum, direction) {
      //Function adds ticket to ticketList
      //  OPT: Assign directly to elevator that can best handle the ticket instead of waiting for route assignment
      ticketList[direction][floorNum] = true;
      console.log('ticket added at', floorNum, direction);
    }
    function addDeliver(floorNum, elevator) {
      //Check if delivery point is beyond our current route, if so, reroute to that target
      deliverMap[floorNum][elevator.num] = true;
      if (
        (elevator.goingUpIndicator() && elevator.destinationQueue[0] < floorNum) ||
        (elevator.goingDownIndicator() && elevator.destinationQueue[0] > floorNum)
      ) {
        console.log('extending route to', floorNum);
        elevator.destinationQueue = [];
        elevator.checkDestinationQueue();
        elevator.goToFloor(floorNum);
        return;
      }
      if (elevator.destinationQueue.length === 0) {
        elevator.goToFloor(floorNum);
      }
    }
    function chartCourse(elevator) { //TODO: Clean up this function
      //Determine location to begin, then goToFloor top floor of the run
      //  Need to look at ticketList and take tickets based on route
      //OPT: Smarter route charting
      console.log(JSON.stringify(ticketList));
      let noTickets = true;
      for (let i = 0; i < floors.length; i++) {
        if (ticketList.down[i]) noTickets = false;
        if (ticketList.up[i]) noTickets = false;
      }
      if (noTickets) {
        //If ticketlist is empty, true idle behavior here
        elevator.goToFloor(elevator.num % floors.length);
        return;
      }
      let maxRange = floors.length * 3
      let upDest = maxRange;
      let downDest = maxRange;
      let upStart = maxRange;
      let downStart = maxRange;
      for (let i = 0; i < floors.length; i++) {
        if (ticketList.up[i]) {
          if (upStart === maxRange) upStart = i;
          upDest = i;
        }
        if (ticketList.down[i]) {
          if (downDest === maxRange) downDest = i;
          downStart = i;
        }
      }
      if (upStart === upDest) upDest++;
      if (downStart === downDest) downDest--;

      const currFloor = elevator.currentFloor();
      if (elevator.goingUpIndicator() && ticketList.up[currFloor]) {
        //Chart route going up from here
        elevator.setIndicator('up');
        elevator.goToFloor(upDest);
        console.log('picking upRoute from current:', currFloor + '-' + upDest);
      } else if (elevator.goingDownIndicator() && ticketList.down[currFloor]) {
        //Chart route going down from here
        elevator.setIndicator('down');
        elevator.goToFloor(downDest);
        console.log('picking downRoute from current:', currFloor + '-' + downDest);
      } else { //Need to determine start point of route
        elevator.relocating = true; //Skip checks on the way to next destination
        //Determine whether to take the up route or the down route based on current location
        if (Math.abs(currFloor - upStart) < Math.abs(currFloor - downStart)) {
          //Go to Upstart, do up-route
          elevator.setIndicator('up');
          elevator.goToFloor(upStart);
          elevator.goToFloor(upDest);
          console.log('picking upRoute:', upStart + '-' + upDest);
        } else {
          //Go to Downstart, do down-route
          elevator.setIndicator('down');
          elevator.goToFloor(downStart);
          elevator.goToFloor(downDest);
          console.log('picking downRoute:', downStart + '-' + downDest);
        }

      }
    }
    function checkStop(floorNum, elevator) {
      if (elevator.relocating) return;
      const del = deliverMap[floorNum][elevator.num];
      const tick = ticketList[elevator.destinationDirection()][floorNum];
      if (del) {
        elevator.goToFloor(floorNum, true);
        return;
      }
      if (tick) {
        const emptySlots = elevator.maxPassengerCount() - elevator.loadFactor() / AVG_WEIGHT * elevator.maxPassengerCount() * 100
        //PassengerCount formula created by peeking at source code
        if (emptySlots < EST_ENTERING || EST_ENTERING * 75 > (1 - elevator.loadFactor()) * 100) {
          //Elevator is too full, return stop to ticketlist and skip
          return;
        }
        ticketList[elevator.destinationDirection()][floorNum] = false;
        elevator.goToFloor(floorNum, true);
        return;
      }
    }
    function cleanupStop(floorNum, elevator) {
      const dir = elevator.goingUpIndicator() ? 'up' : 'down';
      elevator.relocating = false;
      deliverMap[floorNum][elevator.num] = false;
      ticketList[dir][floorNum] = false;
    }

    //Event binding, shouldn't handle any real logic, just link to coordinator
    for (let i = 0; i < elevators.length; i++) {
      const elevator = elevators[i];
      elevator.on('floor_button_pressed', floorNum => {
        addDeliver(floorNum, elevator);
      });
      elevator.on('passing_floor', (floorNum, direction) => {
        checkStop(floorNum, elevator);
      });
      elevator.on('stopped_at_floor', floorNum => {
        cleanupStop(floorNum, elevator);
      });
      elevator.on('idle', () => {
        chartCourse(elevator);
      });
      elevator.setIndicator = direction => {
        elevator.goingUpIndicator(direction === 'up');
        elevator.goingDownIndicator(direction === 'down');
      }
      elevator.num = i;
    }
    for (const floor of floors) {
      floor.on('up_button_pressed', () => {
        addTicket(floor.floorNum(), 'up');
      });
      floor.on('down_button_pressed', () => {
        addTicket(floor.floorNum(), 'down');
      });
    }
  },
  update: function(dt, elevators, floors) {
    // We normally don't need to do anything here
  }
}