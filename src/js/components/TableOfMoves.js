import React from 'react/addons';

import GameStore from '../stores/GameStore';
import onGameChange from '../mixins/onGameChange';


const TableOfMoves = React.createClass({
  
  mixins: [React.addons.PureRenderMixin, onGameChange],

  getInitialState() {
    return {
      moves: GameStore.getMoves()
    };
  },
  render() {
    return (
      <table id="moves" className="clearfix">
        <tbody>
          {this.state.moves.map((row, i) => (
            <tr key={i}>
              <td>
                <strong>{`${i + 1}.`}</strong>
              </td>
              {row.map((move, j) => (
                <td key={j}>
                  <span>{move}</span>
                </td>
              )).toArray()}
            </tr>
          )).toArray()}
        </tbody>
      </table>
    );
  },
  _onGameChange() {
    this.setState({
      moves: GameStore.getMoves()
    });
  }
});

export default TableOfMoves;
