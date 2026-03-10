#include<iostream>
#include<vector>
using namespace std;

int main(){
    int N = 5;
    int pointer = 3;
    {
        // graph
        vector<vector<int>> adjcent_matrix(N,vector<int>(N,0));
        vector<vector<int>> adjcent_matrix2(N,vector<int>(N,0));
        vector<vector<int>> adjcent_list(N);
        vector<pair<int,int>> pair_next{{-1,-1},{0,1},{0,2},{1,1},{1,2}};
        vector<vector<pair<int,int>>> pair_list(N);
        vector<array<int,3>> uvw {{1,2,1},{2,3,1},{1,4,2},{2,4,3}};
        vector<int> next(N);
        // tree
        vector<int> p{-1,0,0,1,1};
        vector<vector<int>> child{{1,2},{},{3,4},{},{}};
        for(int i = 0;i < N;i++) next[i] = (i+1)%N;
        for(int i = 0;i < N;i++){
            for(int j = 0;j < N;j++){
                if(i < j){
                    adjcent_list[i].push_back(j);
                    adjcent_matrix[i][j] = true;
                    adjcent_matrix[i][j] = 67;

                    pair_list[i].push_back({j,i+j});
                }
            }
        }
        cout << next[1] << "\n";
    }

    cout << N << '\n';
}
