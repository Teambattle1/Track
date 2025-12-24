      {showGameChooser && (
          <GameChooser 
              games={gameState.games}
              taskLists={gameState.taskLists}
              onSelectGame={handleSelectGame}
              onCreateGame={(name, fromId) => handleCreateGame({ name }, fromId)}
              onClose={() => {
                  setShowGameChooser(false);
                  if (!activeGame) setShowLanding(true);
                  ensureDesktopMode();
              }}
              onSaveAsTemplate={async (gid, name) => {
                  const g = gameState.games.find(x => x.id === gid);
                  if (g) {
                      const newList: TaskList = {
                          id: `list-${Date.now()}`,
                          name,
                          description: g.description,
                          tasks: g.points.map(p => ({ ...p, id: `tpl-${Date.now()}-${p.id}` })),
                          color: '#3b82f6',
                          createdAt: Date.now()
                      };
                      await db.saveTaskList(newList);
                      const lists = await db.fetchTaskLists();
                      setGameState(prev => ({ ...prev, taskLists: lists }));
                  }
              }}
              onOpenGameCreator={() => setShowGameCreator(true)}
              onRefresh={async () => {
                  const [g, l, t] = await Promise.all([db.fetchGames(), db.fetchTaskLists(), db.fetchLibrary()]);
                  setGameState(prev => ({ ...prev, games: g, taskLists: l, taskLibrary: t }));
              }}
              onUpdateList={handleUpdateTaskList}
              onEditGame={(id) => {
                  setEditingGameMetadataId(id);
                  setShowGameCreator(true);
              }}
          />
      )}