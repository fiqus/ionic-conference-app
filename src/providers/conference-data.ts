import { Injectable } from '@angular/core';

import { Http } from '@angular/http';

import { UserData } from './user-data';


@Injectable()
export class ConferenceData {
  data: any;

  constructor(public http: Http, public user: UserData) {}

  load() {
    if (this.data) {
      // already loaded data
      return Promise.resolve(this.data);
    }

    // don't have the data yet
    return new Promise(resolve => {
      // We're using Angular Http provider to request the data,
      // then on the response it'll map the JSON data to a parsed JS object.
      // Next we process the data and resolve the promise with the new data.
      this.http.get('http://ar.pycon.org/schedule.json').subscribe(res => {
        // we've got back the raw data, now generate the core schedule data
        // and save the data for later reference
        this.data = this.processData(res.json());
        resolve(this.data);
      });
    });
  }

  processData(data) {
    // just some good 'ol JS fun with objects and arrays
    // build up the data by linking speakers to sessions

    data.tracks = [];
    data.confDays = [];
    // loop through each day in the schedule
    data.schedule.forEach(day => {
      data.confDays.push(day);
      // loop through each timeline group in the day
      day.groups.forEach(group => {
        // loop through each session in the timeline group
        group.sessions.forEach(session => {
          this.processSession(data, session);
        });
      });
    });

    return data;
  }

  processSession(data, session) {
    // loop through each speaker and load the speaker data
    // using the speaker name as the key
    session.speakers = [];
    // formateo el name de las plenarias, porque pueden venir con html desde el endpoint
    if(session.kind == "plenaria") {
      session.name = session.name.replace(/(?:\\[rn]|[\r\n]+)+/g, ' ', 'gi').replace(/(<([^>]+)>)/ig, '').trim();
    }

    if (session.speakerNames) {
      session.speakerNames.forEach(speakerName => {
        let speaker = data.speakers.find(s => s.name === speakerName);
        if (speaker && speaker.name != '') {
          session.speakers.push(speaker);
          speaker.sessions = speaker.sessions || [];
          speaker.sessions.push(session);
        }
      });
    }
    if(!session.tracks) {
      session.tracks = ["Python"]
    }
    if (session.tracks) {
      session.tracks.forEach(track => {
        if (data.tracks.indexOf(track) < 0) {
          data.tracks.push(track);
        }
      });
    }
  }

  getTimeline(dayIndex, queryText = '', excludeTracks = [], segment = 'all') {
    return this.load().then(data => {
        let i = 0;
        let days = [];
      for (i; i < data.confDays.length; i = i + 1) {
        let day = data.schedule[i];
        day.shownSessions = 0;
        day.show = false;

        queryText = queryText.toLowerCase().replace(/,|\.|-/g, ' ');
        let queryWords = queryText.split(' ').filter(w => !!w.trim().length);
        if(day != "undefined"){
            day.groups.forEach(group => {
              group.hide = true;
              group.sessions.forEach(session => {
                
                // check if this session should show or not
                this.filterSession(session, queryWords, excludeTracks, segment);

                if (!session.hide) {
                  // if this session is not hidden then this group should show
                  group.hide = false;
                  day.shownSessions++;
                }
              });
            });
            days.push(day);
        }
      }
      return days;
    });
  }

  filterSession(session, queryWords, excludeTracks, segment) {
    
    let matchesQueryText = false;
    if (queryWords.length) {
      // of any query word is in the session name than it passes the query test
      queryWords.forEach(queryWord => {
        if (session.name.toLowerCase().indexOf(queryWord) > -1) {
          matchesQueryText = true;
        }
      });
    } else {
      // if there are no query words then this session passes the query test
      matchesQueryText = true;
    }

    //Hack para poner de nombre el almuerzo / acreditaciones y sacar los slots libres
    if(session.name.toLowerCase() === 'slot') {
      if(session.kind.toLowerCase() === 'libre') {
        matchesQueryText = false;
      } else {
        session.name = session.kind;
      }
    }
    
    //console.log('session.name', session.name);
    //console.log('session.kind', session.kind);

    // if any of the sessions tracks are not in the
    // exclude tracks then this session passes the track test
    let matchesTracks = false;
    session.tracks.forEach(trackName => {
      if (excludeTracks.indexOf(trackName) === -1) {
        matchesTracks = true;
      }
    });

    // if the segement is 'favorites', but session is not a user favorite
    // then this session does not pass the segment test
    let matchesSegment = false;
    if (segment === 'favorites') {
      if (this.user.hasFavorite(session.name)) {
        matchesSegment = true;
      }
    } else {
      matchesSegment = true;
    }

    // all tests must be true if it should not be hidden
    session.hide = !(matchesQueryText && matchesTracks && matchesSegment);
    //console.log('session.hide', session.hide);
  
  }

  getSpeakers() {
    return this.load().then(data => {
      let filteredSpeakers = data.speakers.filter(s => s.name != "");
      return filteredSpeakers.sort((a, b) => {
        let aName = a.name.split(' ').pop();
        let bName = b.name.split(' ').pop();
        return aName.localeCompare(bName);
      });
    });
  }

  getTracks() {
    return this.load().then(data => {
      return data.tracks.sort();
    });
  }

  getMap() {
    return this.load().then(data => {
      return data.map;
    });
  }

  getConfDays(){
    return this.load().then(data => {
      return data.confDays;
    });
  }

}
