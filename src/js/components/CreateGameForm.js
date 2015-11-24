import React from 'react/addons';

const CreateGameForm = React.createClass({

  propTypes: {
    link: React.PropTypes.string.isRequired,
    time: React.PropTypes.string.isRequired,
    inc: React.PropTypes.string.isRequired,
    onChangeForm: React.PropTypes.func.isRequired,
    createGame: React.PropTypes.func.isRequired
  },
  mixins: [React.addons.PureRenderMixin],

  render() {
    return (
      <form onSubmit={this.props.createGame}>
			<input
			 id="game-link"
			 type="text"
			 value={this.props.link || ''}
			 onClick={e => e.target.select()}
			 readOnly />
			<button type="submit" className="btn">OK</button>
        <fieldset>
          <label style={{paddingLeft: '2em'}}>
            <span>minutes: </span>
            <input
              type="number"
              name="time"
              value={this.props.time}
              onChange={this.props.onChangeForm}
              min="1"
              max="50"
              required />
          </label>
          <label style={{paddingLeft: '2em'}}>
            <span>increment: </span>
            <input
              type="number"
              name="inc"
              value={this.props.inc}
              onChange={this.props.onChangeForm}
              min="0"
              max="50"
              required />
          </label>
        </fieldset>

      </form>
    );
  }
});

export default CreateGameForm;
